#include "Framework/PresidentPlayerController.h"
#include "Simulation/PresidentialGameInstance.h"
void APresidentPlayerController::BeginPlay() { Super::BeginPlay(); bShowMouseCursor=false; if(UPresidentialGameInstance* Sim=GetGameInstance<UPresidentialGameInstance>()) if(Sim->State.PresidentName.IsEmpty()) Sim->StartNewGame(TEXT("President"),1); }