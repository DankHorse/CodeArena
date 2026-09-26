from dataclasses import dataclass
from enum import Enum
from pathlib import Path
import subprocess
import tempfile
from threading import Event, Lock, Thread
import time
from typing import Protocol
from uuid import UUID

from app.core.config import Settings, get_settings


class ExecutionStatus(str, Enum):
    COMPLETED = "completed"
    FAILED = "failed"
    TIMEOUT = "timeout"
    SYSTEM_ERROR = "system_error"


@dataclass(frozen=True)
class ExecutionJob:
    submission_id: UUID
    language: str
    source_code: str
    stdin_data: str = ""


@dataclass(frozen=True)
class ExecutionResult:
    status: ExecutionStatus
    stdout: str
    stderr: str
    exit_code: int | None
    execution_time_ms: int
    error_message: str | None = None


class ExecutionRunner(Protocol):
    def execute(self, job: ExecutionJob) -> ExecutionResult: ...


class DockerExecutionRunner:
    def __init__(self, settings: Settings | None = None) -> None:
        self.settings = settings or get_settings()

    def _build_command(self, job: ExecutionJob, source_path: Path, container_name: str) -> list[str]:
        settings = self.settings
        memory = f"{settings.execution_memory_limit_mb}m"
        mount = f"type=bind,src={source_path},dst=/workspace/main.py,readonly"
        return [
            settings.execution_docker_binary,
            "run",
            "--rm",
            f"--name={container_name}",
            "--network=none",
            "--read-only",
            f"--memory={memory}",
            f"--memory-swap={memory}",
            f"--cpus={settings.execution_cpu_limit}",
            f"--pids-limit={settings.execution_pids_limit}",
            "--cap-drop=ALL",
            "--security-opt=no-new-privileges:true",
            "--user=65534:65534",
            "--tmpfs=/tmp:rw,noexec,nosuid,nodev,size=16m",
            "--workdir=/tmp",
            "--ulimit=nofile=64:64",
            "--init",
            "--env=PYTHONDONTWRITEBYTECODE=1",
            f"--mount={mount}",
            "--stop-timeout=1",
            settings.execution_docker_image,
            "python",
            "-I",
            "-B",
            "/workspace/main.py",
        ]

    def execute(self, job: ExecutionJob) -> ExecutionResult:
        if job.language != "python":
            return ExecutionResult(
                ExecutionStatus.SYSTEM_ERROR,
                "",
                "",
                None,
                0,
                "The isolated worker currently supports Python only.",
            )
        source = job.source_code.encode("utf-8")
        input_data = job.stdin_data.encode("utf-8")
        if len(input_data) > self.settings.execution_max_input_bytes:
            return ExecutionResult(
                ExecutionStatus.FAILED, "", "", None, 0, "Execution input exceeded its configured limit."
            )

        container_name = f"codearena-{job.submission_id.hex}"
        with tempfile.TemporaryDirectory(prefix="codearena-execution-") as directory:
            source_path = Path(directory) / "main.py"
            source_path.write_bytes(source)
            source_path.chmod(0o444)
            command = self._build_command(job, source_path, container_name)
            started = time.monotonic()
            try:
                process = subprocess.Popen(
                    command,
                    stdin=subprocess.PIPE,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.PIPE,
                    bufsize=0,
                )
            except OSError as exc:
                return ExecutionResult(
                    ExecutionStatus.SYSTEM_ERROR,
                    "",
                    "",
                    None,
                    int((time.monotonic() - started) * 1000),
                    f"Unable to start the Docker execution runtime ({type(exc).__name__}).",
                )

            stdout = bytearray()
            stderr = bytearray()
            output_size = [0]
            output_lock = Lock()
            output_exceeded = Event()
            readers = [
                Thread(
                    target=self._drain,
                    args=(pipe, buffer, output_size, output_lock, output_exceeded),
                    daemon=True,
                )
                for pipe, buffer in ((process.stdout, stdout), (process.stderr, stderr))
            ]
            for reader in readers:
                reader.start()
            writer = Thread(target=self._write_input, args=(process.stdin, input_data), daemon=True)
            writer.start()

            timed_out = False
            while process.poll() is None:
                if output_exceeded.is_set():
                    break
                if time.monotonic() - started >= self.settings.execution_timeout_seconds:
                    timed_out = True
                    break
                time.sleep(0.01)

            output_limited = output_exceeded.is_set()
            if timed_out or output_limited:
                self._remove_container(container_name)
                self._stop_client(process)

            try:
                process.wait(timeout=2)
            except subprocess.TimeoutExpired:
                process.kill()
                process.wait(timeout=2)
            for reader in readers:
                reader.join(timeout=2)
            writer.join(timeout=1)
            output_limited = output_limited or output_exceeded.is_set()

            duration_ms = int((time.monotonic() - started) * 1000)
            stdout_text = bytes(stdout).decode("utf-8", errors="replace")
            stderr_text = bytes(stderr).decode("utf-8", errors="replace")
            if timed_out:
                status = ExecutionStatus.TIMEOUT
                error_message = (
                    f"Execution exceeded the {self.settings.execution_timeout_seconds}-second time limit."
                )
            elif output_limited:
                status = ExecutionStatus.FAILED
                error_message = f"Execution output exceeded {self.settings.execution_max_output_bytes} bytes."
            elif process.returncode in (125, 126, 127):
                status = ExecutionStatus.SYSTEM_ERROR
                error_message = "The Docker runtime could not start the configured execution command."
                stdout_text = ""
                stderr_text = ""
            elif process.returncode == 0:
                status = ExecutionStatus.COMPLETED
                error_message = None
            else:
                status = ExecutionStatus.FAILED
                error_message = f"Execution process exited with code {process.returncode}."

            return ExecutionResult(
                status=status,
                stdout=stdout_text,
                stderr=stderr_text,
                exit_code=process.returncode,
                execution_time_ms=duration_ms,
                error_message=error_message,
            )

    def _drain(
        self,
        pipe,
        buffer: bytearray,
        output_size: list[int],
        lock: Lock,
        exceeded: Event,
    ) -> None:
        limit = self.settings.execution_max_output_bytes
        while True:
            chunk = pipe.read(4096)
            if not chunk:
                return
            with lock:
                remaining = max(0, limit - output_size[0])
                kept = chunk[:remaining]
                buffer.extend(kept)
                output_size[0] += len(kept)
                if len(chunk) > remaining:
                    exceeded.set()

    @staticmethod
    def _write_input(pipe, data: bytes) -> None:
        try:
            if data:
                pipe.write(data)
                pipe.flush()
        except (BrokenPipeError, OSError):
            pass
        finally:
            try:
                pipe.close()
            except OSError:
                pass

    def _remove_container(self, name: str) -> None:
        try:
            subprocess.run(
                [self.settings.execution_docker_binary, "rm", "--force", name],
                check=False,
                stdin=subprocess.DEVNULL,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
                timeout=5,
            )
        except (OSError, subprocess.TimeoutExpired):
            pass

    @staticmethod
    def _stop_client(process: subprocess.Popen) -> None:
        if process.poll() is not None:
            return
        try:
            process.terminate()
        except ProcessLookupError:
            return
        try:
            process.wait(timeout=2)
        except subprocess.TimeoutExpired:
            process.kill()
