#include "World/PresidentialStation.h"
#include "Components/BoxComponent.h"
APresidentialStation::APresidentialStation() { InteractionVolume = CreateDefaultSubobject<UBoxComponent>(TEXT("InteractionVolume")); RootComponent = InteractionVolume; InteractionVolume->SetBoxExtent(FVector(70.f)); }
FText APresidentialStation::GetInteractionLabel_Implementation() const { return DisplayName.IsEmpty() ? FText::FromString(TEXT("Use station")) : DisplayName; }
void APresidentialStation::Interact_Implementation(APawn* InstigatorPawn) { OnStationInteracted.Broadcast(Category, InstigatorPawn); }