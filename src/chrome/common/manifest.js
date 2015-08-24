import { chrome } from "../../common/globals";
import { from_json } from "../../util/json";


export const manifest = from_json(chrome["runtime"]["getManifest"]());
