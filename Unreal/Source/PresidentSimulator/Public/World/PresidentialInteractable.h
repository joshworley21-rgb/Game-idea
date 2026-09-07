#pragma once
#include "CoreMinimal.h"
#include "UObject/Interface.h"
#include "PresidentialInteractable.generated.h"
UINTERFACE(BlueprintType) class UPresidentialInteractable : public UInterface { GENERATED_BODY() };
class PRESIDENTSIMULATOR_API IPresidentialInteractable {
    GENERATED_BODY()
public:
    UFUNCTION(BlueprintNativeEvent, BlueprintCallable, Category="Interaction") FText GetInteractionLabel() const;
    UFUNCTION(BlueprintNativeEvent, BlueprintCallable, Category="Interaction") void Interact(APawn* InstigatorPawn);
};