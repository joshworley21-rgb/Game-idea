using UnrealBuildTool;

public class PresidentSimulator : ModuleRules
{
    public PresidentSimulator(ReadOnlyTargetRules Target) : base(Target)
    {
        PCHUsage = PCHUsageMode.UseExplicitOrSharedPCHs;
        PublicDependencyModuleNames.AddRange(new[] {
            "Core", "CoreUObject", "Engine", "InputCore", "EnhancedInput", "UMG",
            "AIModule", "NavigationSystem", "Niagara", "GameplayTags", "GameplayTasks",
            "CinematicCamera", "AnimationCore", "ControlRig", "LiveLinkInterface"
        });
    }
}