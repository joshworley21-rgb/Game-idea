#include "Framework/PresidentGameMode.h"
#include "Player/PresidentCharacter.h"
#include "Framework/PresidentPlayerController.h"
#include "World/ExecutiveComplexBuilder.h"
#include "EngineUtils.h"
APresidentGameMode::APresidentGameMode() { DefaultPawnClass=APresidentCharacter::StaticClass(); PlayerControllerClass=APresidentPlayerController::StaticClass(); }
void APresidentGameMode::BeginPlay() {
    Super::BeginPlay();
    for (TActorIterator<AExecutiveComplexBuilder> It(GetWorld()); It; ++It) return;
    AExecutiveComplexBuilder* Builder = GetWorld()->SpawnActor<AExecutiveComplexBuilder>();
    if (Builder) Builder->BuildComplex();
}