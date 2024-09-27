const fcl = require("@onflow/fcl");
const { ec: EC } = require("elliptic");
const SHA3 = require("sha3").SHA3;
require("dotenv").config();

const ec = new EC("p256");

// Configure FCL
fcl
  .config()
  .put("accessNode.api", "https://rest-testnet.onflow.org")
  .put("flow.network", "testnet")
  .put("0xFUNGIBLETOKENADDRESS", "0x9a0766d93b6608b7")
  .put("0xFLOWTOKENADDRESS", "0x7e60df042a9c0868");

// Your existing Flow account details (the account that will create the new account)
const FLOW_ACCOUNT_ADDRESS = process.env.SERVICE_ACCOUNT_ADDRESS;
const FLOW_ACCOUNT_PRIVATE_KEY = process.env.PRIVATE_KEY;
const FLOW_ACCOUNT_KEY_INDEX = 0; // Usually 0 for the first key

function generateKeyPair() {
  const keys = ec.genKeyPair();
  const privateKey = keys.getPrivate().toString("hex");
  const publicKey = keys.getPublic("hex").replace(/^04/, "");
  return { privateKey, publicKey };
}

function hashMessage(msg) {
  const sha = new SHA3(256);
  sha.update(Buffer.from(msg, "hex"));
  return sha.digest();
}

function signWithKey(privateKey, msg) {
  const key = ec.keyFromPrivate(Buffer.from(privateKey, "hex"));
  const sig = key.sign(hashMessage(msg));
  const n = 32;
  const r = sig.r.toArrayLike(Buffer, "be", n);
  const s = sig.s.toArrayLike(Buffer, "be", n);
  return Buffer.concat([r, s]).toString("hex");
}

const authorization = (address, keyIndex, privateKey) => {
  return async (account) => {
    return {
      ...account,
      tempId: `${address}-${keyIndex}`,
      addr: fcl.sansPrefix(address),
      keyId: Number(keyIndex),
      signingFunction: (signable) => {
        return {
          addr: fcl.withPrefix(address),
          keyId: Number(keyIndex),
          signature: signWithKey(privateKey, signable.message),
        };
      },
    };
  };
};

async function createAccount() {
  const { publicKey, privateKey } = generateKeyPair();

  const transactionCode = `
    transaction(publicKey: String) {
      prepare(signer: &Account) {
        let account = signer
        account.addPublicKey(publicKey.decodeHex())
      }
    }
  `;

  try {
    const transactionId = await fcl.mutate({
      cadence: transactionCode,
      args: (arg, t) => [arg(publicKey, t.String)],
      proposer: authorization(
        FLOW_ACCOUNT_ADDRESS,
        FLOW_ACCOUNT_KEY_INDEX,
        FLOW_ACCOUNT_PRIVATE_KEY
      ),
      payer: authorization(
        FLOW_ACCOUNT_ADDRESS,
        FLOW_ACCOUNT_KEY_INDEX,
        FLOW_ACCOUNT_PRIVATE_KEY
      ),
      authorizations: [
        authorization(
          FLOW_ACCOUNT_ADDRESS,
          FLOW_ACCOUNT_KEY_INDEX,
          FLOW_ACCOUNT_PRIVATE_KEY
        ),
      ],
      limit: 1000,
    });

    console.log("Transaction ID:", transactionId);
    const tx = await fcl.tx(transactionId).onceSealed();
    console.log("Transaction sealed");

    const event = tx.events.find(
      (event) => event.type === "flow.AccountCreated"
    );
    if (!event) {
      throw new Error("AccountCreated event not found");
    }

    const newAccountAddress = event.data.address;
    console.log("New account created with address:", newAccountAddress);

    return {
      address: newAccountAddress,
      publicKey: publicKey,
      privateKey: privateKey,
    };
  } catch (error) {
    console.error("Error creating account:", error);
    throw error;
  }
}

async function main() {
  try {
    const newAccount = await createAccount();
    console.log("New account details:", newAccount);
  } catch (error) {
    console.error("An error occurred:", error);
  }
}

main();
