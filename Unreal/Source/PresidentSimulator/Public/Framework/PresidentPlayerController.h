#pragma once
#include "CoreMinimal.h"
#include "GameFramework/PlayerController.h"
#include "PresidentPlayerController.generated.h"
UCLASS() class PRESIDENTSIMULATOR_API APresidentPlayerController : public APlayerController { GENERATED_BODY() public: virtual void BeginPlay() override; };