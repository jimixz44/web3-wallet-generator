import inquirer from 'inquirer';
import { ethers } from 'ethers';
import { Keypair } from '@solana/web3.js';
import bs58 from 'bs58';
import { Ed25519Keypair } from '@mysten/sui.js/keypairs/ed25519';
import { SuiClient, getFullnodeUrl } from '@mysten/sui.js/client';
import TonWeb from 'tonweb';
import tonMnemonic from 'tonweb-mnemonic';
import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';
import ora from 'ora';
import * as bip39 from 'bip39';
import { derivePath } from 'ed25519-hd-key';

// =======================================================================
// SECTION: HELPERS & STYLING
// =======================================================================

const AnsiColors = {
    reset: "\x1b[0m",
    cyan: "\x1b[36m",
    yellow: "\x1b[33m",
    green: "\x1b[32m",
    red: "\x1b[31m",
    blue: "\x1b[34m",
    magenta: "\x1b[35m",
    bold: "\x1b[1m",
    dim: "\x1b[2m",
    italic: "\x1b[3m",
};

const colorize = (text, ...styles) => {
    const styleString = styles.map(style => AnsiColors[style] || '').join('');
    return `${styleString}${text}${AnsiColors.reset}`;
};

const SYMBOLS = {
    prompt: colorize('➤', 'blue', 'bold'),
    success: colorize('✔', 'green'),
    error: colorize('✖', 'red'),
    info: colorize('●', 'cyan'),
    warning: colorize('▲', 'yellow')
};

function printBox(title, lines, color = 'cyan') {
    const cleanLines = lines.map(line => line.replace(/\x1b\[[0-9;]*m/g, ''));
    const maxLength = Math.max(title.length, ...cleanLines.map(line => line.length));
    const horizontalLine = '═'.repeat(maxLength + 4);
    const verticalLine = colorize('║', color);

    const contentWidth = maxLength + 4;
    const titleString = ` ${title} `;
    const padding = Math.floor((contentWidth - titleString.length) / 2);
    const paddedTitle = titleString.padStart(titleString.length + padding).padEnd(contentWidth);

    console.log(colorize(`╔${horizontalLine}╗`, color));
    console.log(colorize(`║${paddedTitle}║`, color, 'bold'));
    console.log(colorize(`╠${horizontalLine.replace(/═/g, '─')}╣`, color));
    
    lines.forEach(line => {
        const paddedLine = line.padEnd(maxLength + (line.length - cleanLines[lines.indexOf(line)].length));
        console.log(`${verticalLine}  ${paddedLine}  ${verticalLine}`);
    });

    console.log(colorize(`╚${horizontalLine}╝`, color));
}

// =======================================================================
// SECTION: WALLET SORTER LOGIC
// =======================================================================

function getWalletFiles(directory) {
    try {
        if (!fs.existsSync(directory)) return [];
        const allFiles = fs.readdirSync(directory);
        return allFiles.filter(file => file.endsWith('.txt') && !file.match(/_(addresses|privatekeys|mnemonics)\.txt$/));
    } catch {
        return [];
    }
}

function processWalletFile(inputFile, dataType = 'all') {
    try {
        const content = fs.readFileSync(inputFile, 'utf-8');
        const wallets = {};
        if (['all', 'addresses'].includes(dataType)) {
            wallets.addresses = [...content.matchAll(/(?:Public Address|address): *([^\n\r]+)/gi)].map(m => m[1].trim());
        }
        if (['all', 'private_keys'].includes(dataType)) {
            wallets.private_keys = [...content.matchAll(/(?:Private Key|privateKey|secretKey): *([^\n\r]+)/gi)].map(m => m[1].trim());
        }
        if (['all', 'mnemonics'].includes(dataType)) {
            let mnemonics = [...content.matchAll(/(?:Mnemonic Phrase|Mnemonic|Seed Phrase|Seed): *([^\n\r]+)/gi)].map(m => m[1].trim());
            if (mnemonics.length === 0) {
                const lines = content.trim().split(/[\n\r]+/);
                mnemonics = lines.filter(line => {
                    const words = line.trim().split(/\s+/);
                    return words.length >= 12 && words.length <= 24 && words.every(w => w.length >= 2);
                });
            }
            wallets.mnemonics = mnemonics;
        }
        return wallets;
    } catch {
        return null;
    }
}

function saveSortedData(wallets, inputFile, outputDir, dataType = 'all') {
    try {
        fs.mkdirSync(outputDir, { recursive: true });
        const baseName = path.parse(inputFile).name;
        if (['all', 'addresses'].includes(dataType) && wallets.addresses?.length) fs.writeFileSync(path.join(outputDir, `${baseName}_addresses.txt`), wallets.addresses.join('\n'));
        if (['all', 'private_keys'].includes(dataType) && wallets.private_keys?.length) fs.writeFileSync(path.join(outputDir, `${baseName}_privatekeys.txt`), wallets.private_keys.join('\n'));
        if (['all', 'mnemonics'].includes(dataType) && wallets.mnemonics?.length) fs.writeFileSync(path.join(outputDir, `${baseName}_mnemonics.txt`), wallets.mnemonics.join('\n\n'));
        return true;
    } catch {
        return false;
    }
}

async function runSorter(walletDir) {
    while (true) {
        console.clear();
        printBox("Wallet Data Sorter", ["Pilih file untuk memisahkan Address, Private Key, & Mnemonic."], "magenta");

        const walletFiles = getWalletFiles(walletDir);
        if (walletFiles.length === 0) {
            console.log(`\n${SYMBOLS.error} ${colorize("Tidak ada file wallet yang ditemukan di folder 'daftar-wallet'.", "yellow")}`);
            await new Promise(resolve => setTimeout(resolve, 2500));
            break;
        }

        const { fileToProcess } = await inquirer.prompt([{
            type: 'list', name: 'fileToProcess', message: 'File mana yang ingin Anda sortir?', prefix: SYMBOLS.prompt,
            choices: [...walletFiles, new inquirer.Separator(), 'Kembali ke Menu'],
            pageSize: 15,
        }]);

        if (fileToProcess === 'Kembali ke Menu') break;

        const { dataChoice } = await inquirer.prompt([{
            type: 'list', name: 'dataChoice', message: 'Data apa yang ingin Anda ekstrak?', prefix: SYMBOLS.prompt,
            choices: [
                { name: 'Semua (Address, Private Key, Mnemonic)', value: 'all' },
                { name: 'Hanya Address', value: 'addresses' },
                { name: 'Hanya Private Key', value: 'private_keys' },
                { name: 'Hanya Mnemonic', value: 'mnemonics' },
            ],
        }]);

        const spinner = ora({
            text: colorize('Memproses dan memisahkan data...', 'blue'),
            spinner: {
                interval: 120,
                frames: ['🕛 ', '🕐 ', '🕑 ', '🕒 ', '🕓 ', '🕔 ', '🕕 ', '🕖 ', '🕗 ', '🕘 ', '🕙 ', '🕚 ']
            }
        }).start();
        const inputFile = path.join(walletDir, fileToProcess);
        const wallets = processWalletFile(inputFile, dataChoice);
        const outputDir = path.join(walletDir, "sorted_wallets");
        const success = saveSortedData(wallets, inputFile, outputDir, dataChoice);
        spinner.stop();

        if (success) {
            const resultLines = [
                `Folder Output: ${colorize(path.basename(outputDir), 'yellow')}`, '',
                wallets.addresses?.length ? `${SYMBOLS.success} ${wallets.addresses.length} Address ditemukan.` : `${SYMBOLS.error} Address tidak ditemukan.`,
                wallets.private_keys?.length ? `${SYMBOLS.success} ${wallets.private_keys.length} Private Key ditemukan.` : `${SYMBOLS.error} Private Key tidak ditemukan.`,
                wallets.mnemonics?.length ? `${SYMBOLS.success} ${wallets.mnemonics.length} Mnemonic ditemukan.` : `${SYMBOLS.error} Mnemonic tidak ditemukan.`,
            ];
            printBox("Proses Sortir Selesai", resultLines, "green");
        } else {
            console.log(`\n${SYMBOLS.error} ${colorize("Gagal memproses atau menyimpan file.", "red")}`);
        }

        const { again } = await inquirer.prompt([{ type: 'confirm', name: 'again', message: 'Ingin menyortir file lain?', prefix: SYMBOLS.prompt, default: false }]);
        if (!again) break;
    }
}

// =======================================================================
// SECTION: WALLET GENERATION LOGIC
// =======================================================================

class BaseWalletGenerator {
  constructor() { this.outputDir = path.join(process.cwd(), "daftar-wallet"); }
  async ensureOutputDirExists() { await fsp.mkdir(this.outputDir, { recursive: true }).catch(() => {}); }
  async saveToFile(wallets, fileName) {
    await this.ensureOutputDirExists();
    const filePath = path.join(this.outputDir, fileName);
    const content = wallets.map((wallet, index) => {
        const keyOrder = ['mnemonic', 'address', 'privateKey', 'secretKey'];
        let sortedEntries = Object.entries(wallet)
            .sort((a, b) => keyOrder.indexOf(a[0]) - keyOrder.indexOf(b[0]))
            .filter(([, value]) => value);
        return `--- Wallet #${index + 1} ---\n` + sortedEntries.map(([key, value]) => `${key.charAt(0).toUpperCase() + key.slice(1)}: ${value}`).join("\n");
      }).join("\n\n");
    await fsp.writeFile(filePath, content);
    return filePath;
  }
  async generateBulkWallets(count, networkName, fileName, options = {}) {
    const wallets = [];
    const spinner = ora({
        text: colorize(`Membuat 0/${count} wallet...`, 'blue'),
        spinner: {
            interval: 120,
            frames: ['🕛 ', '🕐 ', '🕑 ', '🕒 ', '🕓 ', '🕔 ', '🕕 ', '🕖 ', '🕗 ', '🕘 ', '🕙 ', '🕚 ']
        }
    }).start();
    try {
        for (let i = 0; i < count; i++) {
            spinner.text = colorize(`Membuat ${i + 1}/${count} wallet ${networkName}...`, 'blue');
            wallets.push(await this.generateWallet(options));
            const progress = Math.floor((i + 1) / count * 20);
            const progressBar = `[${'█'.repeat(progress)}${'░'.repeat(20 - progress)}]`;
            spinner.prefixText = colorize(progressBar, 'cyan');
        }
        spinner.succeed(colorize(`Berhasil membuat ${count} wallet!`, 'green', 'bold'));
        const filePath = await this.saveToFile(wallets, fileName);
        const resultLines = [
            `Jaringan: ${colorize(networkName, 'yellow')}`,
            `Jumlah   : ${colorize(count, 'yellow')}`,
            `File     : ${colorize(fileName, 'yellow')}`,
            `Lokasi   : ${colorize(this.outputDir, 'yellow', 'dim')}`,
        ];
        printBox("Penyimpanan Selesai", resultLines, "green");
    } catch (error) {
        spinner.fail(`Error: ${error.message}`);
    }
  }
  async generateWallet(options = {}) { throw new Error("Not implemented"); }
}

class EVMWalletGenerator extends BaseWalletGenerator {
  async generateWallet(options = {}) {
    const wallet = ethers.Wallet.createRandom();
    const privateKey = options.pkFormat === 'without_0x'
        ? wallet.privateKey.substring(2)
        : wallet.privateKey;
    return { address: wallet.address, privateKey: privateKey, mnemonic: wallet.mnemonic.phrase };
  }
}
class SolanaWalletGenerator extends BaseWalletGenerator {
    async generateWallet(options = {}) {
        const mnemonic = bip39.generateMnemonic(128); 
        const seed = await bip39.mnemonicToSeed(mnemonic);
        const { key } = derivePath("m/44'/501'/0'/0'", seed.toString('hex'));
        const keypair = Keypair.fromSeed(key);
        return { mnemonic, address: keypair.publicKey.toString(), privateKey: bs58.encode(keypair.secretKey) };
    }
}
class SuiWalletGenerator extends BaseWalletGenerator {
  async generateWallet(options = {}) {
    // Generate a 12-word mnemonic
    const mnemonic = bip39.generateMnemonic(128);
    // Derive the keypair from the mnemonic using the correct method
    const keypair = Ed25519Keypair.deriveKeypair(mnemonic);
    return {
      mnemonic: mnemonic,
      address: keypair.getPublicKey().toSuiAddress(),
      privateKey: keypair.export().privateKey
    };
  }
}
class TONWalletGenerator extends BaseWalletGenerator {
  constructor() { super(); this.tonweb = new TonWeb(); }
  async generateWallet(options = {}) {
    const words = await tonMnemonic.generateMnemonic();
    const keyPair = TonWeb.utils.keyPairFromSeed(await tonMnemonic.mnemonicToSeed(words));
    const wallet = new (this.tonweb.wallet.all["v4R2"])(this.tonweb.provider, { publicKey: keyPair.publicKey });
    const address = await wallet.getAddress();
    return { mnemonic: words.join(" "), address: address.toString(true, true, true), secretKey: TonWeb.utils.bytesToHex(keyPair.secretKey) };
  }
}

// =======================================================================
// SECTION: MAIN APPLICATION SERVICE
// =======================================================================

class WalletManagerService {
  constructor() {
    this.generators = { EVM: new EVMWalletGenerator(), SOL: new SolanaWalletGenerator(), SUI: new SuiWalletGenerator(), TON: new TONWalletGenerator() };
    this.outputDir = path.join(process.cwd(), "daftar-wallet");
  }

  async generateWallets() {
      console.clear();
      printBox("Buat Wallet Baru", ["Pilih jaringan dan jumlah wallet yang ingin Anda buat."], "magenta");
      const { network } = await inquirer.prompt([{ type: 'list', name: 'network', message: 'Pilih jaringan blockchain:', prefix: SYMBOLS.prompt, choices: Object.keys(this.generators) }]);
      
      let options = {};
      if (network === 'EVM') {
          const { pkFormat } = await inquirer.prompt([{
              type: 'list',
              name: 'pkFormat',
              message: 'Pilih format private key EVM:',
              prefix: SYMBOLS.prompt,
              choices: [
                  { name: 'Dengan awalan 0x', value: 'with_0x' },
                  { name: 'Tanpa awalan 0x', value: 'without_0x' }
              ]
          }]);
          options.pkFormat = pkFormat;
      }

      const { count } = await inquirer.prompt([{ type: 'input', name: 'count', message: 'Jumlah wallet:', prefix: SYMBOLS.prompt, default: 1, validate: i => (parseInt(i) > 0) || 'Masukkan angka yang valid.' }]);
      
      const { baseName } = await inquirer.prompt([{ 
          type: 'input', 
          name: 'baseName', 
          message: 'Nama file (opsional, .txt ditambahkan otomatis):',
          prefix: SYMBOLS.prompt, 
          default: `${network}_${Date.now()}`
      }]);

      // Secara otomatis menambahkan .txt jika belum ada
      const fileName = baseName.endsWith('.txt') ? baseName : `${baseName}.txt`;

      await this.generators[network].generateBulkWallets(parseInt(count), network, fileName, options);

      const { wantToSort } = await inquirer.prompt([{ type: 'confirm', name: 'wantToSort', message: 'Lanjutkan untuk menyortir file wallet?', prefix: SYMBOLS.prompt, default: false }]);
      if (wantToSort) await runSorter(this.outputDir);
  }
  
  async start() {
    while (true) {
        console.clear();
        const title = "WALLET GENERATOR TOOLS";
        const description = [
            colorize("Aplikasi Manajemen Wallet Multi-Chain", 'cyan', 'italic')
        ];
        
        printBox(title, description, 'magenta');

        const { action } = await inquirer.prompt([{
            type: 'list', name: 'action', message: 'Pilih tindakan:', prefix: SYMBOLS.prompt,
            choices: [
                { name: 'Buat Wallet Baru', value: 'create' },
                { name: 'Sortir Wallet dari File', value: 'sort' },
                new inquirer.Separator(),
                { name: 'Keluar', value: 'exit' },
            ],
        }]);

        if (action === 'create') await this.generateWallets();
        else if (action === 'sort') await runSorter(this.outputDir);
        else if (action === 'exit') break;
        
        const { again } = await inquirer.prompt([{ type: 'confirm', name: 'again', message: 'Kembali ke menu utama?', prefix: SYMBOLS.prompt, default: true }]);
        if (!again) break;
    }
    console.log(colorize('\nTerima kasih telah menggunakan aplikasi ini! Sampai jumpa lagi.\n', 'bold', 'blue'));
  }
}

// =======================================================================
// SECTION: APPLICATION ENTRY POINT
// =======================================================================

(async () => {
  const manager = new WalletManagerService();
  await manager.start();
})();