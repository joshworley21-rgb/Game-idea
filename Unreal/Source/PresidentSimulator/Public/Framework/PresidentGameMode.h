#pragma once
#include "CoreMinimal.h"
#include "GameFramework/GameModeBase.h"
#include "PresidentGameMode.generated.h"
UCLASS()
class PRESIDENTSIMULATOR_API APresidentGameMode : public AGameModeBase {
    GENERATED_BODY()
public:
    APresidentGameMode();
    virtual void BeginPlay() override;
};