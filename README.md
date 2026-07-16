# Aegis

Aegis is a trustless, milestone-based escrow marketplace built on Stellar and Soroban. Buyers lock funds in a smart contract, sellers deliver work in milestones, and disputes can be resolved by an arbiter while the platform keeps a transparent on-chain reputation history.

## Why this project exists

Traditional freelance and marketplace payments rely on trust and manual dispute handling. Aegis replaces that with:

- on-chain escrow that holds funds until milestones are completed
- transparent fee accounting and reputation updates
- dispute handling with a neutral arbiter
- a real-time frontend for monitoring transactions and activity

## Key features

- Milestone-based escrow flows
- On-chain reputation scoring
- Dispute resolution support
- Event-driven activity feeds
- Transaction lifecycle tracking with retry support
- Multi-wallet support through Stellar wallet integrations

## Architecture overview

The project is split into two main parts:

- Smart contracts in [contracts](contracts)
- A Next.js frontend in [web](web)

The contracts handle escrow logic, registry state, reputation, and treasury accounting. The frontend connects to those contracts, displays events, and manages wallet interactions.

## Smart contracts

The workspace contains two Soroban contracts:

- Escrow contract: manages escrow creation, milestone release, refunds, cancellations, disputes, and settlement
- Registry contract: tracks reputation, fees, and shared marketplace state

## Current testnet deployment

The project is currently deployed on Stellar Testnet.

| Contract | Network | Address |
| --- | --- | --- |
| Escrow | Testnet | [CDCMC3RTUTX3P7WV2JQI64VSBRSH777RWYTQKPXYP3CLGFCPQNXLCAEN](https://stellar.expert/explorer/testnet/contract/CDCMC3RTUTX3P7WV2JQI64VSBRSH777RWYTQKPXYP3CLGFCPQNXLCAEN) |
| Registry | Testnet | [CBAEFKKISEH5TECLSHAIN22MM4K2XFJHITPLPEWS4NYXXAUED3XAGYI2](https://stellar.expert/explorer/testnet/contract/CBAEFKKISEH5TECLSHAIN22MM4K2XFJHITPLPEWS4NYXXAUED3XAGYI2) |

## Project structure

```text
.
├── contracts/          # Soroban smart contract workspace
├── web/                # Next.js frontend
├── scripts/            # deployment and contract automation scripts
├── deployments/        # deployment metadata
├── docs/               # deployment and security documentation
└── .github/workflows/  # CI/CD workflows
```

## Local development

### Prerequisites

- Rust
- Cargo
- Node.js 20+
- Stellar CLI

Install the required Rust target:

```bash
rustup target add wasm32v1-none
```

### Run the contracts

```bash
cd contracts
cargo test
stellar contract build
```

### Run the frontend

```bash
cd web
cp .env.example .env.local
npm install
npm run dev
```

## Testing

```bash
cd contracts && cargo test
cd web && npm run test
```

## Deployment

Use the provided scripts for local or testnet deployment:

```bash
./scripts/deploy_testnet.sh
```

Additional deployment and security details are available in [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) and [docs/SECURITY.md](docs/SECURITY.md).

## License

This project is licensed under the MIT License.
