# Aegis contracts — developer convenience targets.
#
# Run from the contracts/ directory:  make build | test | fmt | clippy | clean
# The deploy-testnet target shells out to ../scripts/deploy_testnet.sh.

.PHONY: build test fmt clippy clean deploy-testnet

# Build the optimised on-chain WASM for every contract in the workspace.
build:
	stellar contract build

# Run unit and integration tests.
test:
	cargo test

# Apply rustfmt across the whole workspace.
fmt:
	cargo fmt --all

# Lint with clippy, failing the build on any warning (matches CI).
clippy:
	cargo clippy --all-targets -- -D warnings

# Remove build artifacts.
clean:
	cargo clean

# Build + deploy + initialize on testnet via the ops script.
# Honors STELLAR_NETWORK / IDENTITY / FEE_BPS overrides from the environment.
deploy-testnet:
	../scripts/deploy_testnet.sh
