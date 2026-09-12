import { actionCooldownLeft, actionsFor, STATION_INFO } from "../../game/actions.ts";
import { describeEffects } from "../../game/effects.ts";
import { memberById } from "../../game/family.ts";
import type { GameState, StationId } from "../../game/types.ts";
import type { Engine } from "../../game/engine.ts";
import { el, meter } from "../dom.ts";
import { personRow } from "../speakerView.ts";
import { chips, panel, type PanelHost } from "./host.ts";
