# Use Debian Bookworm Slim as base - much smaller than Ubuntu (74MB vs 117MB)
FROM debian:bookworm-slim

# Install only runtime dependencies in a single layer
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        ca-certificates \
        libssl3 \
        libgcc-s1 \
        libstdc++6 \
    && rm -rf /var/lib/apt/lists/* \
    && apt-get clean

WORKDIR /opt/app

# Copy the binary with executable permissions
COPY --chmod=755 target/release/radiusinfra .

# Define volume mount point for config
VOLUME ["/opt/app/config"]

# Expose application port
EXPOSE 8014

# Run as non-root user for security
RUN useradd -r -u 1000 -s /sbin/nologin appuser && \
    chown -R appuser:appuser /opt/app

USER appuser

CMD ["./radiusinfra"]
