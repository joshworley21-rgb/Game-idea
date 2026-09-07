using UnrealBuildTool;

public class PresidentSimulatorTarget : TargetRules
{
    public PresidentSimulatorTarget(TargetInfo Target) : base(Target)
    {
        Type = TargetType.Game;
        DefaultBuildSettings = BuildSettingsVersion.V5;
        IncludeOrderVersion = EngineIncludeOrderVersion.Unreal5_4;
        ExtraModuleNames.Add("PresidentSimulator");
    }
}