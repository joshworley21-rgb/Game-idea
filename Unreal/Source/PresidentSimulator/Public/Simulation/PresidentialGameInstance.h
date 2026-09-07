#pragma once
#include "CoreMinimal.h"
#include "Engine/GameInstance.h"
#include "Simulation/PresidentialSimulationTypes.h"
#include "PresidentialGameInstance.generated.h"

DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FSimulationStateChanged, const FPresidentialGameState&, State);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FPresidentialActionResolved, const FString&, Message);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FCrisisRaised, const FCrisisState&, Crisis);

UCLASS(BlueprintType)
class PRESIDENTSIMULATOR_API UPresidentialGameInstance : public UGameInstance {
    GENERATED_BODY()
public:
    UPROPERTY(BlueprintAssignable) FSimulationStateChanged OnStateChanged;
    UPROPERTY(BlueprintAssignable) FPresidentialActionResolved OnActionResolved;
    UPROPERTY(BlueprintAssignable) FCrisisRaised OnCrisisRaised;
    UPROPERTY(BlueprintReadOnly) FPresidentialGameState State;
    UFUNCTION(BlueprintCallable) void StartNewGame(const FString& PresidentName, int32 Seed);
    UFUNCTION(BlueprintCallable) bool PerformAction(const FPresidentialAction& Action, FString& OutReason);
    UFUNCTION(BlueprintCallable) bool ProposeBill(FName BillId, float ExtraCapital, FString& OutReason);
    UFUNCTION(BlueprintCallable) bool ResolveCrisis(FName CrisisId, bool bStrongResponse, FString& OutReason);
    UFUNCTION(BlueprintCallable) bool AdvanceMonth(FString& OutReason);
    UFUNCTION(BlueprintCallable) void RecalculateApproval();
    UFUNCTION(BlueprintPure) FPresidentialGameState GetSimulationState() const { return State; }
private:
    void BroadcastState();
    void Finish(EEndingType Type);
};