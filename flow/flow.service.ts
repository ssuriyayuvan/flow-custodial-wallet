import * as fcl from "@onflow/fcl";
import type { TransactionStatus } from '@onflow/typedefs';

export type NetworkType = "mainnet" | "testnet" | "emulator";

let isGloballyInited = false;
let globallyPromise = null;

export default class FlowService {
  public readonly network: NetworkType;
  private readonly flowJSON: object;

  /**
   * Initialize the Flow SDK
   */
  constructor(flowJSON: object) {
    this.network =
      (import.meta.env.PUBLIC_FLOW_NETWORK as NetworkType) ?? "emulator";
    this.flowJSON = flowJSON;
  }

  async onModuleInit() {
    if (isGloballyInited) return;

    const cfg = fcl.config();
    // Required
    await cfg.put("flow.network", this.network);
    // Set the maximum of gas limit
    await cfg.put("fcl.limit", 9999);

    switch (this.network) {
      case "mainnet":
        await cfg.put(
          "accessNode.api",
          import.meta.env.INTERNAL_MAINNET_ENDPOINT ??
            "https://mainnet.onflow.org"
        );
        break;
      case "testnet":
        await cfg.put("accessNode.api", "https://testnet.onflow.org");
        break;
      case "emulator":
        await cfg.put("accessNode.api", "http://localhost:8888");
        break;
      default:
        throw new Error(`Unknown network: ${String(this.network)}`);
    }

    // Load Flow JSON
    await cfg.load({ flowJSON: this.flowJSON });

    isGloballyInited = true;
  }

  /**
   * Ensure the Flow SDK is initialized
   */
  private async ensureInited() {
    if (isGloballyInited) return;
    if (!globallyPromise) {
      globallyPromise = this.onModuleInit();
    }
    return await globallyPromise;
  }

  /**
   * Get account information
   */
  async getAccount(addr: string): Promise<any> {
    await this.ensureInited();
    return await fcl.send([fcl.getAccount(addr)]).then(fcl.decode);
  }

  /**
   * General method of sending transaction
   */
  async sendTransaction(
    code: string,
    args: fcl.ArgumentFunction,
    mainAuthz?: fcl.FclAuthorization,
    extraAuthz?: fcl.FclAuthorization[]
  ) {
    await this.ensureInited();
    if (typeof mainAuthz !== "undefined") {
      return await fcl.mutate({
        cadence: code,
        args: args,
        proposer: mainAuthz,
        payer: mainAuthz,
        authorizations:
          (extraAuthz?.length ?? 0) === 0
            ? [mainAuthz]
            : [mainAuthz, ...extraAuthz],
      });
    } else {
      return await fcl.mutate({
        cadence: code,
        args: args,
      });
    }
  }

  /**
   * Get transaction status
   */
  async getTransactionStatus(
    transactionId: string
  ): Promise<TransactionStatus> {
    await this.ensureInited();
    return await fcl.tx(transactionId).onceExecuted();
  }

  /**
   * Get chain id
   */
  async getChainId() {
    await this.ensureInited();
    return await fcl.getChainId();
  }

  /**
   * Send transaction with single authorization
   */
  async onceTransactionSealed(
    transactionId: string
  ): Promise<TransactionStatus> {
    await this.ensureInited();
    return fcl.tx(transactionId).onceSealed();
  }

  /**
   * Get block object
   * @param blockId
   */
  async getBlockHeaderObject(blockId: string): Promise<fcl.BlockHeaderObject> {
    await this.ensureInited();
    return await fcl
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      .send([fcl.getBlockHeader(), fcl.atBlockId(blockId)])
      .then(fcl.decode);
  }

  /**
   * Send script
   */
  async executeScript<T>(
    code: string,
    args: fcl.ArgumentFunction,
    defaultValue: T
  ): Promise<T> {
    await this.ensureInited();
    try {
      const queryResult = await fcl.query({
        cadence: code,
        args,
      });
      return (queryResult as T) ?? defaultValue;
    } catch (e) {
      console.error(e);
      return defaultValue;
    }
  }
}
