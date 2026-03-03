# Multi-Chain Wallet Generator

A powerful and user-friendly tool to generate wallets for multiple blockchain networks. This tool supports EVM-compatible chains, Solana, Sui, and TON, with built-in data sorting capabilities.

## 🚀 Fitur Utama

- **Multi-Chain Support**:
  - **EVM**: Ethereum, BSC, Polygon, Arbitrum, etc. (Pilihan format Private Key dengan/tanpa `0x`).
  - **Solana**: Generasi wallet berbasis mnemonic 12 kata.
  - **Sui**: Generasi wallet Ed25519.
  - **TON**: Generasi wallet v4R2.
- **Bulk Generation**: Membuat banyak wallet sekaligus dalam satu kali proses.
- **Wallet Sorter**: Memisahkan Address, Private Key, dan Mnemonic dari file teks ke file terpisah secara otomatis.
- **UI Interaktif**: Menggunakan antarmuka command-line (CLI) yang cantik dengan spinner dan box styling.
- **Auto-Save**: Hasil wallet disimpan secara otomatis di folder `daftar-wallet/`.

## 📋 Persyaratan Sistem

- **Node.js**: Minimal versi **v18.0.0** (wajib ya, kalau di bawah ini nanti error).
- **NPM**: Biasanya sudah otomatis terinstal bareng Node.js.

## 🛠️ Instalasi

1. Clone repositori ini atau download source code:
   ```bash
   git clone https://github.com/jimixz44/web3-wallet-generator.git
   cd web3-wallet-generator
   ```

2. Install dependensi:
   ```bash
   npm install
   ```

## 🚀 Cara Menjalankan

Jalankan aplikasi dengan perintah:

```bash
npm start
```

Atau gunakan node secara langsung:

```bash
node creates.js
```

## 📂 Struktur Output

Semua wallet yang dibuat akan disimpan di dalam folder:
`daftar-wallet/`

File sortir akan muncul di dalam sub-folder:
`daftar-wallet/sorted_wallets/`

## 📦 Dependensi Utama

- `ethers`: Library untuk interaksi dengan EVM.
- `@solana/web3.js`: Web3 library untuk Solana.
- `@mysten/sui.js`: Library untuk Sui blockchain.
- `tonweb`: Library untuk TON blockchain.
- `inquirer`: Untuk antarmuka CLI interaktif.
- `ora`: Untuk animasi spinner di terminal.

---
Dibuat dengan ❤️ untuk komunitas Web3.
