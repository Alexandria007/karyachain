# KaryaChain

**Own Your Creative Work. Forever.**

Live Demo: [karyachain-g1nt.vercel.app](https://karyachain-g1nt.vercel.app)

KaryaChain is a decentralized content ownership platform for creators, built on Shelby Protocol and Aptos blockchain. Upload your work, get cryptographic proof of ownership, and monetize your content no platform can take it away.

## Features

- Proof of Ownership - Every upload gets a cryptographic receipt anchored on Aptos blockchain
- Hot Storage - Powered by Shelby Protocol, sub-second access from anywhere in the world
- Creator Economy - Gate premium content, set your price, get paid in ShelbyUSD
- Petra Wallet - Connect your Aptos wallet to manage your works

## Tech Stack

- **Frontend**: React + TypeScript + Vite
- **Styling**: Tailwind CSS
- **Storage**: Shelby Protocol (`@shelby-protocol/sdk`)
- **Blockchain**: Aptos (`@aptos-labs/ts-sdk`)
- **Wallet**: Aptos Wallet Adapter (`@aptos-labs/wallet-adapter-react`)
- **Deploy**: Vercel

## Getting Started

Prerequisites: Node.js v22+ and [Petra Wallet](https://petra.app/) browser extension.

```bash
git clone https://github.com/Alexandria007/karyachain
cd karyachain
npm install --legacy-peer-deps
npm run dev
```

Open `http://localhost:5173`

## How It Works

1. Connect your Petra wallet
2. Upload your work - music, photo, writing, or video
3. Receive a cryptographic receipt anchored on Aptos
4. View and manage all your stored works from the dashboard

## Network

| Network | RPC | Status |
|---------|-----|--------|
| shelbynet | `https://api.shelbynet.shelby.xyz/shelby` | Active |
| testnet | `https://api.testnet.shelby.xyz/shelby` | Early Access |

Real Shelby upload integration is pending Early Access approval. Current upload flow uses mock data for demonstration.

## Project Structure

```
src/
  components/
    Header.tsx        # Navigation and wallet connect
    Hero.tsx          # Landing page
    UploadSection.tsx # File upload interface
    MyWorks.tsx       # Works dashboard
  hooks/
    useWallet.ts      # Petra wallet integration
  App.tsx
  main.tsx
```

## Roadmap

- [x] UI with dark theme and gold accent
- [x] Petra Wallet integration
- [x] Upload interface with drag and drop
- [x] My Works dashboard
- [ ] Real Shelby Protocol upload (pending Early Access)
- [ ] On-chain ownership proof via Aptos
- [ ] Premium content gating with ShelbyUSD
- [ ] Creator analytics dashboard

## References

- [Shelby Protocol Docs](https://docs.shelby.xyz)
- [Aptos Developer Docs](https://aptos.dev)
- [Shelby Explorer](https://explorer.shelby.xyz)

## License

MIT

Built by Raden Ayu Alexandria Ananditha Jayawardana Gumay - Yogyakarta, Indonesia
