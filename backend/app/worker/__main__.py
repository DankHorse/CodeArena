import logging

from app.worker.service import run_worker


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
    run_worker()


if __name__ == "__main__":
    main()
