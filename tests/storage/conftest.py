"""Exercise storage SQL against PostgreSQL via PGlite, with no remote services."""

import asyncio
import json
from contextlib import asynccontextmanager
from datetime import datetime
from pathlib import Path

import pytest


class Postgres:
    """Small asyncpg-shaped bridge to the real PostgreSQL query engine."""

    def __init__(self, process):
        self.process = process
        self.closed = False
        self.queries = []
        self.in_transaction = False

    async def fetch(self, sql, *args, script=False):
        self.queries.append((sql, args))
        request = json.dumps(
            {"sql": sql, "args": args, "script": script},
            default=lambda value: value.isoformat(),
        )
        self.process.stdin.write((request + "\n").encode())
        await self.process.stdin.drain()
        line = await self.process.stdout.readline()
        if not line:
            raise RuntimeError((await self.process.stderr.read()).decode())
        result = json.loads(line)
        if "error" in result:
            raise RuntimeError(result["error"])
        for row in result["rows"]:
            if row.get("published_at"):
                row["published_at"] = datetime.fromisoformat(row["published_at"])
        return result["rows"]

    async def fetchval(self, sql, *args):
        rows = await self.fetch(sql, *args)
        return next(iter(rows[0].values())) if rows else None

    async def execute(self, sql, *args):
        await self.fetch(sql, *args)

    def is_in_transaction(self):
        return self.in_transaction

    @asynccontextmanager
    async def transaction(self):
        await self.execute("BEGIN")
        self.in_transaction = True
        try:
            yield
        except BaseException:
            await self.execute("ROLLBACK")
            raise
        else:
            await self.execute("COMMIT")
        finally:
            self.in_transaction = False

    async def close(self):
        self.closed = True


@pytest.fixture
async def pg():
    root = Path(__file__).resolve().parents[2]
    process = await asyncio.create_subprocess_exec(
        "node",
        "tests/storage/postgres_bridge.mjs",
        cwd=root,
        stdin=asyncio.subprocess.PIPE,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    try:
        line = await process.stdout.readline()
        assert line, (await process.stderr.read()).decode()
        assert json.loads(line) == {"ready": True}
        yield Postgres(process)
    finally:
        process.stdin.close()
        await process.wait()


@pytest.fixture
async def connected(pg, monkeypatch):
    async def connect(*args, **kwargs):
        return pg

    monkeypatch.setattr("src.storage.db.asyncpg.connect", connect)
    return pg
