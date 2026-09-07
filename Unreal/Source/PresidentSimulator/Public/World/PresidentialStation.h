#pragma once
#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "Simulation/PresidentialSimulationTypes.h"
#include "World/PresidentialInteractable.h"
#include "PresidentialStation.generated.h"
class UBoxComponent;
DECLARE_DYNAMIC_MULTICAST_DELEGATE_TwoParams(FStationInteracted, EStationCategory, StationCategory, APawn*, InteractingPawn);
UCLASS(Blueprintable)
class PRESIDENTSIMULATOR_API APresidentialStation : public AActor, public IPresidentialInteractable {
    GENERATED_BODY()
public:
    APresidentialStation();
    UPROPERTY(VisibleAnywhere, BlueprintReadOnly) TObjectPtr<UBoxComponent> InteractionVolume;
    UPROPERTY(EditAnywhere, BlueprintReadWrite) EStationCategory Category = EStationCategory::ResoluteDesk;
    UPROPERTY(EditAnywhere, BlueprintReadWrite) FText DisplayName;
    /** Bind UI routing here to open the panel for Category. */
    UPROPERTY(BlueprintAssignable, Category="Interaction") FStationInteracted OnStationInteracted;
    virtual FText GetInteractionLabel_Implementation() const override;
    virtual void Interact_Implementation(APawn* InstigatorPawn) override;
};