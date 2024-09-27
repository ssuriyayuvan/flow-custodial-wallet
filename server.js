require("dotenv").config();
const { ec: EC } = require("elliptic");
const ec = new EC("p256");
const fcl = require("@onflow/fcl");
const crypto = require("crypto");

fcl
  .config()
  .put("accessNode.api", "https://access-testnet.onflow.org")
  .put("discovery.wallet", "https://fcl-discovery.onflow.org/testnet/authn");

const hashMessage = (msg) => {
  const sha3Hash = crypto.createHash("sha3-256");
  sha3Hash.update(Buffer.from(msg, "hex"));
  return sha3Hash.digest();
};

const serviceAccountAddress = process.env.SERVICE_ACCOUNT_ADDRESS;
const privateKey = process.env.PRIVATE_KEY;

// const receiver = "0xbe3ef902f840168a";
// const receiverPrivateKey =
//   "958946f1d4ccf281f1bbd668c4df25296d75da86047a833fd0e81a53117606e5";
const keyIndex = 0; // Index of the key you want to use in your account

const produceSignature = (privateKey, msg) => {
  const key = ec.keyFromPrivate(Buffer.from(privateKey, "hex"));
  const sig = key.sign(msg);
  const n = 32;
  const r = sig.r.toArrayLike(Buffer, "be", n);
  const s = sig.s.toArrayLike(Buffer, "be", n);
  return Buffer.concat([r, s]).toString("hex");
};

console.log(serviceAccountAddress);
const authorization = (account) => {
  //   const key = ec.keyFromPrivate(Buffer.from(privateKey, "hex"));
  return {
    ...account,
    tempId: `${serviceAccountAddress}-${keyIndex}`,
    addr: fcl.withPrefix(serviceAccountAddress),
    keyId: keyIndex,
    signingFunction: async (signable) => {
      // Hash the message as required by Flow
      const message = signable.message;
      const hashedMessage = hashMessage(message);

      return {
        addr: fcl.withPrefix(serviceAccountAddress),
        keyId: keyIndex,
        signature: produceSignature(privateKey, hashedMessage),
      };
    },
  };
};

const sendTransaction = async () => {
  try {
    console.log("authorization", authorization());
    const txId = await fcl.mutate({
      cadence: `
        transaction {
          prepare(signer: &Account) {
              
          }
          execute {
            log("Transaction signed and sent successfully")
          }
        }`,
      args: (arg, t) => [],
      proposer: authorization,
      payer: authorization,
      authorizations: [authorization],
      limit: 100,
    });

    console.log("Transaction ID:-->", txId);
    fcl.tx(txId).subscribe((s) => {
      console.log("Status", s.status, s.blockId);
    });
  } catch (error) {
    console.error("Transaction failed:", error);
  }
};

sendTransaction();
