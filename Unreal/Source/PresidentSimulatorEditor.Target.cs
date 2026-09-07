using UnrealBuildTool;

public class PresidentSimulatorEditorTarget : TargetRules
{
    public PresidentSimulatorEditorTarget(TargetInfo Target) : base(Target)
    {
        Type = TargetType.Editor;
        DefaultBuildSettings = BuildSettingsVersion.V5;
        IncludeOrderVersion = EngineIncludeOrderVersion.Unreal5_4;
        ExtraModuleNames.Add("PresidentSimulator");
    }
}