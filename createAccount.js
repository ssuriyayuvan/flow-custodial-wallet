const { String, UInt8 } = require("@onflow/types");
const elliptic = require("elliptic");
const sha3 = require("js-sha3");
const fcl = require("@onflow/fcl");
// Choose between 'p256' (ECDSA_P256) or 'secp256k1' (ECDSA_secp256k1)
const dotenv = require("dotenv");
dotenv.config();
const crypto = require("crypto");
const { ec: EC } = require("elliptic");
const ec = new EC("p256");
// Generate ECDSA key pair

fcl.config().put("accessNode.api", "https://access-testnet.onflow.org");

const serviceAccountAddress = process.env.SERVICE_ACCOUNT_ADDRESS;
const privateKey = process.env.PRIVATE_KEY;

fcl.authz;

const generateKeyPair = () => {
  const keyPair = ec.genKeyPair();
  //   const keyPair = EC.keyFromPrivate(
  //     "021e20133ab08069f75811b841cfe1f81a8490c9fdd776f3e4853d4702311696"
  //   );

  // Extract private and public keys
  const privateKey = keyPair.getPrivate("hex"); // Private key in hex format
  const publicKey = keyPair.getPublic("hex"); // Uncompressed public key in hex format
  // Flow needs the public key in a specific format (compressed)
  const publicKeyCompressed = keyPair.getPublic(true, "hex"); // Compressed public key

  return { privateKey, publicKey, publicKeyCompressed };
};

// Hash the public key using SHA3-256 (Flow requirement)
const hashPublicKey = (publicKey) => {
  return sha3.sha3_256(Buffer.from(publicKey, "hex"));
};

const sendTransaction = async (publicKey) => {
  try {
    console.log("authorization", authorization());

    const txId = await fcl.mutate({
      cadence: `
            import Crypto
  
  transaction(key: String, signatureAlgorithm: UInt8, hashAlgorithm: UInt8) {
      prepare(signer: auth(BorrowValue, Storage) &Account) {
          pre {
              signatureAlgorithm >= 1 && signatureAlgorithm <= 3: "Must provide a signature algorithm raw value that is 1, 2, or 3"
              hashAlgorithm >= 1 && hashAlgorithm <= 6: "Must provide a hash algorithm raw value that is between 1 and 6"
            
          }
  
          let publicKey = PublicKey(
              publicKey: key.decodeHex(),
              signatureAlgorithm: SignatureAlgorithm(rawValue: signatureAlgorithm)!
          )
  
          let account = Account(payer: signer)
  
          log("hello")
  
          //account.keys.add(publicKey: publicKey, hashAlgorithm: HashAlgorithm(rawValue: hashAlgorithm)!, weight: 999)
  
          log(account.keys.get(keyIndex: 0))
      }
      execute {
      log("account finished")
      }
  }`,
      args: (arg, t) => [arg(publicKey, String), arg(1, UInt8), arg(1, UInt8)],
      proposer: authorization,
      payer: authorization,
      authorizations: [authorization],
      limit: 100,
    });

    console.log("Transaction ID:-->", txId);
    fcl.tx(txId).subscribe((s) => {
      console.log("Status", s.status, s.blockId);
      const accountCreatedEvent = s.events.find(
        (event) => event.type === "flow.AccountCreated"
      );

      if (accountCreatedEvent) {
        const accountAddress = accountCreatedEvent.data;
        console.log("New account created with address:", accountAddress);
        return accountAddress;
      } else {
        console.log("No account creation event found.");
      }
    });
  } catch (error) {
    console.error("Transaction failed:", error);
  }
};

// Generate wallet
const generateFlowWallet = () => {
  const { privateKey, publicKey, publicKeyCompressed } = generateKeyPair();
  const hashedPublicKey = hashPublicKey(publicKey);

  console.log("Private Key (keep this secret):", privateKey);
  console.log("Public Key (share this with Flow):", publicKey);
  console.log("SHA3-256 Hashed Public Key:", hashedPublicKey);
  console.log("Compressed Hashed Public Key:", publicKeyCompressed);

  // The public key is now ready to be added to a Flow account
  sendTransaction(publicKey.substring(2, publicKey.length));
  return { privateKey, publicKey, hashedPublicKey, publicKeyCompressed };
};

const produceSignature = (privateKey, msg) => {
  const key = ec.keyFromPrivate(Buffer.from(privateKey, "hex"));
  const sig = key.sign(msg);
  const n = 32;
  const r = sig.r.toArrayLike(Buffer, "be", n);
  const s = sig.s.toArrayLike(Buffer, "be", n);
  return Buffer.concat([r, s]).toString("hex");
};

console.log(serviceAccountAddress);
const keyIndex = 0;

const hashMessage = (msg) => {
  const sha3Hash = crypto.createHash("sha3-256");
  sha3Hash.update(Buffer.from(msg, "hex"));
  return sha3Hash.digest();
};
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

// Example usage
generateFlowWallet();
