#pragma once
#include "CoreMinimal.h"
#include "Kismet/BlueprintFunctionLibrary.h"
#include "PresidentialSaveLibrary.generated.h"
class UPresidentialGameInstance;
UCLASS() class PRESIDENTSIMULATOR_API UPresidentialSaveLibrary : public UBlueprintFunctionLibrary {
    GENERATED_BODY()
public:
    UFUNCTION(BlueprintCallable) static bool SaveSimulation(UPresidentialGameInstance* Simulation, const FString& SlotName, int32 UserIndex);
    UFUNCTION(BlueprintCallable) static bool LoadSimulation(UPresidentialGameInstance* Simulation, const FString& SlotName, int32 UserIndex);
};