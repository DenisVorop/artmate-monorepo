# Build context: repository root. No dependency on Node apps or their storage.
FROM python:3.13-slim-bookworm AS build
WORKDIR /build
COPY services/coloring/requirements-build.txt ./
RUN pip install --no-cache-dir -r requirements-build.txt
COPY services/coloring/pyproject.toml services/coloring/README.md ./
COPY services/coloring/src ./src
COPY services/coloring/scripts/prepare_models.py ./scripts/prepare_models.py
RUN python scripts/prepare_models.py
RUN pip wheel --no-cache-dir --no-deps --no-build-isolation . --wheel-dir /wheels

FROM python:3.13-slim-bookworm AS runtime
ENV PYTHONUNBUFFERED=1 PYTHONDONTWRITEBYTECODE=1 OMP_NUM_THREADS=1 OPENBLAS_NUM_THREADS=1
WORKDIR /app
COPY services/coloring/requirements-runtime.txt ./
RUN pip install --no-cache-dir -r requirements-runtime.txt \
    && groupadd --gid 10001 coloring \
    && useradd --uid 10001 --gid coloring --no-create-home coloring \
    && mkdir /data && chown coloring:coloring /data
COPY --from=build /wheels /wheels
RUN pip install --no-cache-dir --no-deps /wheels/*.whl && rm -rf /wheels
USER 10001:10001
WORKDIR /data
ENTRYPOINT ["coloring-generate"]
CMD ["--help"]
