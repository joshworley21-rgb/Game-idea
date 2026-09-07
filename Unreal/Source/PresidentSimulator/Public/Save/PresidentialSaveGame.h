#pragma once
#include "CoreMinimal.h"
#include "GameFramework/SaveGame.h"
#include "Simulation/PresidentialSimulationTypes.h"
#include "PresidentialSaveGame.generated.h"
UCLASS()
class PRESIDENTSIMULATOR_API UPresidentialSaveGame : public USaveGame {
    GENERATED_BODY()
public:
    UPROPERTY(BlueprintReadWrite) FPresidentialGameState SavedState;
    UPROPERTY(BlueprintReadWrite) int32 SaveVersion = 1;
};