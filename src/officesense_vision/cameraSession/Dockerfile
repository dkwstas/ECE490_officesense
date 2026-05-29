ARG BUILDPLATFORM=linux/amd64
FROM --platform=$BUILDPLATFORM golang:1.26-bookworm AS builder

# Install dlib deps
RUN dpkg --add-architecture arm64 && \
    apt-get update && apt-get install -y \
    g++-aarch64-linux-gnu \
    libdlib-dev:arm64 \
    libjpeg-dev:arm64 \
    libblas-dev:arm64 \
    libopenblas-dev:arm64 \
    libatlas-base-dev:arm64 \
    liblapack-dev:arm64 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Compiler wrapper for arm64
RUN printf '#!/bin/bash\nexec aarch64-linux-gnu-gcc "${@//-march=native/-march=armv8-a}"\n' \
      > /usr/local/bin/arm64-gcc && \
    printf '#!/bin/bash\nexec aarch64-linux-gnu-g++ "${@//-march=native/-march=armv8-a}"\n' \
      > /usr/local/bin/arm64-g++ && \
    chmod +x /usr/local/bin/arm64-gcc /usr/local/bin/arm64-g++

# Compiler variables for cross-compile to arm64
ENV CGO_ENABLED=1 \
    GOOS=linux \
    GOARCH=arm64 \
    CC=/usr/local/bin/arm64-gcc \
    CXX=/usr/local/bin/arm64-g++ \
    PKG_CONFIG_PATH=/usr/lib/aarch64-linux-gnu/pkgconfig

COPY go.mod go.sum ./
RUN go mod download

# Pre-compile all CGO deps into cache
RUN go build -v ./... 2>/dev/null || \
    go list -m all && \
    CGO_ENABLED=1 GOOS=linux GOARCH=arm64 \
    go build -gcflags="-trimpath" -v \
    $(go list -f '{{if .CgoFiles}}{{.ImportPath}}{{end}}' ./...) 2>/dev/null; exit 0

RUN --mount=type=cache,target=/root/.cache/go-build \
    --mount=type=cache,target=/go/pkg \
    go mod download

COPY . .

# Build - reuse CGO cache
RUN --mount=type=cache,target=/root/.cache/go-build \
    --mount=type=cache,target=/go/pkg \
    go build -o cameraSession

FROM scratch AS export
COPY --from=builder /app/cameraSession /cameraSession