#!/usr/bin/env node
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";

const root = process.cwd();
const required = [
  "PresidentSimulator.uproject", "Source/PresidentSimulator.Target.cs", "Source/PresidentSimulatorEditor.Target.cs",
  "Source/PresidentSimulator/PresidentSimulator.Build.cs", "Source/PresidentSimulator/PresidentSimulator.cpp",
  "Config/DefaultEngine.ini", "Config/DefaultGame.ini", "Config/DefaultInput.ini",
  "Source/PresidentSimulator/Public/Simulation/PresidentialGameInstance.h",
  "Source/PresidentSimulator/Private/Simulation/PresidentialGameInstance.cpp",
  "Build/Android/PackageAndroid.ps1", "Build/Android/package-android.sh"
];
let errors = [];
for (const file of required) if (!existsSync(join(root, file))) errors.push(`Missing required file: ${file}`);
try {
  const project = JSON.parse(readFileSync(join(root, "PresidentSimulator.uproject"), "utf8"));
  if (!project.Modules?.some((m) => m.Name === "PresidentSimulator" && m.Type === "Runtime")) errors.push("uproject lacks PresidentSimulator runtime module");
  if (!project.Plugins?.some((p) => p.Name === "EnhancedInput" && p.Enabled)) errors.push("EnhancedInput plugin is not enabled");
} catch (error) { errors.push(`Invalid .uproject JSON: ${error.message}`); }
function files(dir) { return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => entry.isDirectory() ? files(join(dir, entry.name)) : [join(dir, entry.name)]); }
const sourceRoot = join(root, "Source", "PresidentSimulator");
if (existsSync(sourceRoot)) {
  const source = files(sourceRoot).filter((f) => /\.(h|cpp)$/.test(f));
  for (const cpp of source.filter((f) => f.endsWith(".cpp"))) {
    for (const [, include] of readFileSync(cpp, "utf8").matchAll(/#include\s+"([^"]+)"/g)) {
      const local = join(sourceRoot, include), publicFile = join(sourceRoot, "Public", include), privateFile = join(sourceRoot, "Private", include);
      const projectInclude = /^(Simulation|World|Player|Characters|Framework|Save)\//.test(include) || include === "PresidentSimulator.h";
      if (projectInclude && !existsSync(local) && !existsSync(publicFile) && !existsSync(privateFile) && !include.endsWith(".generated.h")) errors.push(`${relative(root, cpp)} includes missing project file ${include}`);
    }
  }
}
function text(file) { return readFileSync(join(root, file), "utf8"); }
if (existsSync(join(root, "Config/DefaultEngine.ini"))) {
  const engineConfig = text("Config/DefaultEngine.ini");
  if (!engineConfig.includes("GameDefaultMap=/Engine/Maps/Entry")) errors.push("DefaultEngine.ini must use the engine Entry map for source-only startup");
  if (engineConfig.includes("GameDefaultMap=/Game/")) errors.push("DefaultEngine.ini references a missing authored /Game map");
}
const behaviorFiles = {
  portalHeader: "Source/PresidentSimulator/Public/World/RoomPortal.h",
  portalCpp: "Source/PresidentSimulator/Private/World/RoomPortal.cpp",
  builder: "Source/PresidentSimulator/Private/World/ExecutiveComplexBuilder.cpp",
  station: "Source/PresidentSimulator/Public/World/PresidentialStation.h",
  stationCpp: "Source/PresidentSimulator/Private/World/PresidentialStation.cpp",
  gameMode: "Source/PresidentSimulator/Private/Framework/PresidentGameMode.cpp",
  simulation: "Source/PresidentSimulator/Public/Simulation/PresidentialGameInstance.h"
};
for (const file of Object.values(behaviorFiles)) if (!existsSync(join(root, file))) errors.push(`Missing behavior file: ${file}`);
if (!errors.length) {
  if (!text(behaviorFiles.portalHeader).includes("public IPresidentialInteractable") || !text(behaviorFiles.portalHeader).includes("DestinationTransform")) errors.push("RoomPortal lacks interactable destination support");
  if (!text(behaviorFiles.portalCpp).includes("SetActorLocationAndRotation") || !text(behaviorFiles.portalCpp).includes("OnPortalTravelled")) errors.push("RoomPortal does not safely perform and signal travel");
  if (!text(behaviorFiles.station).includes("BlueprintAssignable") || !text(behaviorFiles.stationCpp).includes("OnStationInteracted.Broadcast")) errors.push("Station interaction delegate is incomplete");
  for (const category of ["ResoluteDesk", "SecureLine", "CabinetBudget", "StaffWestWing", "CongressFloor", "PressPool", "Residence", "PrivateStudy"]) if (!text(behaviorFiles.builder).includes(`EStationCategory::${category}`)) errors.push(`Blockout does not spawn ${category}`);
  if (!text(behaviorFiles.builder).includes("DestinationTransform") || !text(behaviorFiles.gameMode).includes("TActorIterator<AExecutiveComplexBuilder>")) errors.push("Blockout portal pairing or GameMode fallback is missing");
  if (!text(behaviorFiles.simulation).includes("FPresidentialGameState GetSimulationState() const")) errors.push("Simulation state getter must return by value");
}
if (errors.length) { console.error("Validation failed:\n" + errors.map((e) => `- ${e}`).join("\n")); process.exit(1); }
console.log("Validation passed: project descriptor, includes, source-only startup, interaction, portal, station, and simulation-state checks are consistent.");