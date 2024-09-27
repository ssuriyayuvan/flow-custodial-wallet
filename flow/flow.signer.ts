import elliptic from "elliptic";
import * as fcl from "@onflow/fcl";
import type { CompositeSignature } from "@onflow/typedefs";

import { getFlowInstance } from "./flow.service.factory";
import PureSigner from "./pure.signer";

const ec = new elliptic.ec("p256");

export default class FlowSigner {
  constructor(
    public readonly address: string,
    private readonly privateKeyHex?: string
  ) {}

  /**
   * Send a transaction
   * @param code Cadence code
   * @param args Cadence arguments
   */
  async sendTransaction(
    code: string,
    args: fcl.ArgumentFunction,
    authz?: fcl.FclAuthorization
  ) {
    const flowService = await getFlowInstance();
    return await flowService.sendTransaction(
      code,
      args,
      authz ?? this.buildAuthorization()
    );
  }

  /**
   * Execute a script
   * @param code Cadence code
   * @param args Cadence arguments
   */
  async executeScript<T>(
    code: string,
    args: fcl.ArgumentFunction,
    defaultValue: T
  ): Promise<T> {
    const flowService = await getFlowInstance();
    return await flowService.executeScript(code, args, defaultValue);
  }

  /**
   * Build authorization
   */
  buildAuthorization(accountIndex = 0, privateKey = this.privateKeyHex) {
    const address = this.address;
    if (!privateKey) {
      throw new Error("No private key provided");
    }
    return (account: any) => {
      return {
        ...account,
        tempId: `${address}-${accountIndex}`,
        addr: fcl.sansPrefix(address),
        keyId: Number(accountIndex),
        signingFunction: (signable: any): Promise<CompositeSignature> => {
          return Promise.resolve({
            f_type: "CompositeSignature",
            f_vsn: "1.0.0",
            addr: fcl.withPrefix(address),
            keyId: Number(accountIndex),
            signature: this.signMessage(signable.message, privateKey),
          });
        },
      };
    };
  }

  /**
   * Sign a message
   * @param message Message to sign
   */
  signMessage(message: string, privateKey = this.privateKeyHex) {
    return PureSigner.signWithKey(privateKey!, message);
  }
}
