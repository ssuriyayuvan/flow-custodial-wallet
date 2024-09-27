const fcl = require("@onflow/fcl");
const t = require("@onflow/types");
const EC = require("elliptic").ec;
const SHA3 = require("sha3").SHA3;
require("dotenv").config();
// Configure FCL (same as before)
fcl
  .config()
  .put("accessNode.api", "https://access-testnet.onflow.org")
  .put("discovery.wallet", "https://fcl-discovery.onflow.org/testnet/authn");

// Transaction script (same as before)
const transactionScript = `
transaction(message: String) {
  prepare(signer: AuthAccount, payer: AuthAccount) {
    log(message)
    log(signer.address)
    log(payer.address)
  }
}
`;

const serviceAccountAddress = process.env.SERVICE_ACCOUNT_ADDRESS;
const serviceAccountPrivateKey = process.env.PRIVATE_KEY;

const receiver = "0xbe3ef902f840168a";
const receiverPrivateKey =
  "958946f1d4ccf281f1bbd668c4df25296d75da86047a833fd0e81a53117606e5";

// New: Custom authorization function
function signWithKey(privateKey, keyIndex = 0) {
  return (account) => {
    console.log("account --> <-----", account.address);
    return () => {
      console.log("account -->", account.address);
      const addr = account.address || fcl.sansPrefix(account.addr || "");
      const keyId = account.keyId || keyIndex;
      return {
        ...account,
        tempId: `${account.address}-${keyId}`,
        addr: addr,
        keyId: keyId,
        signingFunction: async (signable) => {
          const ec = new EC("p256");
          const key = ec.keyFromPrivate(Buffer.from(privateKey, "hex"));
          const sha3 = new SHA3(256);
          sha3.update(Buffer.from(signable.message, "hex"));
          const digest = sha3.digest();
          const sig = key.sign(digest);

          return {
            addr: account.address,
            keyId: keyId,
            signature:
              sig.r.toString(16).padStart(64, "0") +
              sig.s.toString(16).padStart(64, "0"),
          };
        },
      };
    };
  };
}

// Updated: executeTransaction function
async function executeTransaction(
  signerPrivateKey,
  payerPrivateKey,
  signerAddress,
  payerAddress
) {
  try {
    console.log(
      "DDD-->",
      signWithKey(payerPrivateKey)({ address: payerAddress })
    );
    console.log("singer payer address", signerAddress, payerAddress);
    const transactionId = await fcl.mutate({
      cadence: transactionScript,
      args: (arg, t) => [arg("Hello, Flow!", t.String)],
      payer: signWithKey(payerPrivateKey)({ address: payerAddress }),
      proposer: signWithKey(signerPrivateKey)({ address: signerAddress }),
      //   proposer: signWithKey(signerPrivateKey)({ address: signerAddress }),
      authorizations: [
        signWithKey(signerPrivateKey)({ address: signerAddress }),
      ],
      limit: 999,
    });

    console.log("Transaction ID:", transactionId);

    const transaction = await fcl.tx(transactionId).onceSealed();
    console.log("Transaction sealed", transaction);
  } catch (error) {
    console.error("Error executing transaction:", error);
  }
}

// Example usage
const signerPrivateKey = receiverPrivateKey;
const payerPrivateKey = serviceAccountPrivateKey;
const signerAddress = receiver;
const payerAddress = serviceAccountAddress;

executeTransaction(
  signerPrivateKey,
  payerPrivateKey,
  signerAddress,
  payerAddress
);

// const { ec: EC } = require("elliptic");
// const fcl = require("@onflow/fcl");
// const crypto = require("crypto");

// const ec = new EC("secp256k1");

// const serviceAccountAddress = "0x42b20e395a7a3087"; // Your account address
// const privateKey =
//   "986f9ebe91d0a2f1447cfe7ff83e8a8524d987d6f2dd43cba3e8700c33d51ad7"; // Replace with your private key
// const keyIndex = 0; // Replace with the correct key index
// fcl
//   .config()
//   .put("accessNode.api", "https://access-testnet.onflow.org")
//   .put("discovery.wallet", "https://fcl-discovery.onflow.org/testnet/authn");

// const hashMessage = (msg) => {
//   const sha3Hash = crypto.createHash("sha3-256");
//   sha3Hash.update(Buffer.from(msg, "hex"));
//   return sha3Hash.digest();
// };

// const authorization = async (account) => {
//   const key = ec.keyFromPrivate(Buffer.from(privateKey, "hex"));

//   return {
//     ...account,
//     tempId: `${serviceAccountAddress}-${keyIndex}`,
//     addr: fcl.withPrefix(serviceAccountAddress),
//     keyId: keyIndex,
//     signingFunction: async (signable) => {
//       const message = signable.message;
//       const hashedMessage = hashMessage(message);

//       const signature = key.sign(hashedMessage);

//       const r = signature.r.toString("hex").padStart(64, "0");
//       const s = signature.s.toString("hex").padStart(64, "0");

//       return {
//         addr: fcl.withPrefix(serviceAccountAddress),
//         keyId: keyIndex,
//         signature: r + s,
//       };
//     },
//   };
// };

// const sendTransaction = async () => {
//   try {
//     const txId = await fcl.mutate({
//       cadence: `
//         transaction {
//           prepare(signer: AuthAccount) {
//             log("Transaction signed and sent successfully")
//           }
//         }
//       `,
//       proposer: authorization,
//       payer: authorization,
//       authorizations: [authorization],
//       limit: 100,
//     });

//     console.log("Transaction ID:", txId);
//     fcl.tx(txId).subscribe((e) => console.log(e));
//   } catch (error) {
//     console.error("Transaction failed:", error);
//   }
// };

// sendTransaction();
