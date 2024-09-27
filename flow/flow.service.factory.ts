import FlowService from "./flow.service";
// Here is the configuration file for fixes.
import flowJSON from "@/flow.json" assert { type: "json" };

let _instance: FlowService;
export async function getFlowInstance(): Promise<FlowService> {
  if (!_instance) {
    _instance = new FlowService(flowJSON);
    await _instance.onModuleInit();
  }
  return _instance;
}
