#include "World/RoomPortal.h"
#include "Components/BoxComponent.h"
ARoomPortal::ARoomPortal() { Trigger = CreateDefaultSubobject<UBoxComponent>(TEXT("PortalTrigger")); RootComponent = Trigger; Trigger->SetBoxExtent(FVector(80.f, 40.f, 120.f)); }
FText ARoomPortal::GetInteractionLabel_Implementation() const { return DestinationLabel.IsEmpty() ? FText::FromString(TEXT("Enter passage")) : DestinationLabel; }
void ARoomPortal::Interact_Implementation(APawn* InstigatorPawn) {
    if (!IsValid(InstigatorPawn)) return;
    InstigatorPawn->SetActorLocationAndRotation(DestinationTransform.GetLocation(), DestinationTransform.Rotator(), false, nullptr, ETeleportType::TeleportPhysics);
    OnPortalTravelled(InstigatorPawn);
}