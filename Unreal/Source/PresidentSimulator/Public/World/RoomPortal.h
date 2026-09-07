#pragma once
#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "World/PresidentialInteractable.h"
#include "RoomPortal.generated.h"
class UBoxComponent;
UCLASS(Blueprintable)
class PRESIDENTSIMULATOR_API ARoomPortal : public AActor, public IPresidentialInteractable {
    GENERATED_BODY()
public:
    ARoomPortal();
    UPROPERTY(VisibleAnywhere) TObjectPtr<UBoxComponent> Trigger;
    UPROPERTY(EditAnywhere, BlueprintReadWrite) FName DestinationTag;
    UPROPERTY(EditAnywhere, BlueprintReadWrite) FText DestinationLabel;
    /** World-space arrival point. Builders should set this to the paired portal's room-side exit. */
    UPROPERTY(EditAnywhere, BlueprintReadWrite) FTransform DestinationTransform;
    virtual FText GetInteractionLabel_Implementation() const override;
    virtual void Interact_Implementation(APawn* InstigatorPawn) override;
    UFUNCTION(BlueprintImplementableEvent, Category="Interaction")
    void OnPortalTravelled(APawn* TravellingPawn);
};