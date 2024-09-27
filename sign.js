const { ec: EC } = require("elliptic"); // Import elliptic library
const crypto = require("crypto"); // Node.js built-in crypto library

// Instantiate elliptic with secp256k1 curve
const ec = new EC("secp256k1");

// Define the private key (hex format) of the account
const privateKey =
  "986f9ebe91d0a2f1447cfe7ff83e8a8524d987d6f2dd43cba3e8700c33d51ad7"; // Replace with your actual private key

// Function to hash the message using SHA3-256
const hashMessage = (msg) => {
  // Create a SHA3-256 hash instance
  const sha3Hash = crypto.createHash("sha3-256");
  // Update the hash with the input message
  sha3Hash.update(Buffer.from(msg, "hex"));
  // Return the digest of the hash
  return sha3Hash.digest();
};

// Function to generate the signature
const generateSignature = (message) => {
  // Generate the key pair from the private key
  const key = ec.keyFromPrivate(Buffer.from(privateKey, "hex"));

  // Hash the message using SHA3-256
  const hashedMessage = hashMessage(message);

  // Sign the hashed message
  const signature = key.sign(hashedMessage);

  // Concatenate the r and s components of the signature
  const r = signature.r.toString("hex").padStart(64, "0");
  const s = signature.s.toString("hex").padStart(64, "0");

  // Return the concatenated signature
  return r + s;
};

// Sample message to sign (hex format)
const message = "hello there"; // Replace with the actual message to sign

// Generate the signature
const signature = generateSignature(message);

// Output the generated signature
console.log("Generated Signature:", signature);
