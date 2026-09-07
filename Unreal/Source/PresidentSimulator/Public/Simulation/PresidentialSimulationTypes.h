#pragma once

#include "CoreMinimal.h"
#include "PresidentialSimulationTypes.generated.h"

UENUM(BlueprintType)
enum class EStationCategory : uint8 { ResoluteDesk, CabinetBudget, StaffWestWing, CongressFloor, SecureLine, PressPool, Residence, PrivateStudy };
UENUM(BlueprintType)
enum class EGamePhase : uint8 { Playing, Ended };
UENUM(BlueprintType)
enum class EEndingType : uint8 { None, Reelected, Defeated, Resigned, Incapacitated, TermComplete };

USTRUCT(BlueprintType)
struct FNationalState {
    GENERATED_BODY()
    UPROPERTY(EditAnywhere, BlueprintReadWrite) float Growth = 2.1f;
    UPROPERTY(EditAnywhere, BlueprintReadWrite) float Unemployment = 4.5f;
    UPROPERTY(EditAnywhere, BlueprintReadWrite) float Inflation = 2.5f;
    UPROPERTY(EditAnywhere, BlueprintReadWrite) float DebtToGdp = 98.f;
    UPROPERTY(EditAnywhere, BlueprintReadWrite) float GdpBillions = 27000.f;
    UPROPERTY(EditAnywhere, BlueprintReadWrite) float TaxRate = 19.f;
    UPROPERTY(EditAnywhere, BlueprintReadWrite) float Unrest = 25.f;
    UPROPERTY(EditAnywhere, BlueprintReadWrite) float Standing = 58.f;
    UPROPERTY(EditAnywhere, BlueprintReadWrite) float Security = 62.f;
    UPROPERTY(EditAnywhere, BlueprintReadWrite) TMap<FName, float> SectorQuality;
};
USTRUCT(BlueprintType)
struct FPoliticalState {
    GENERATED_BODY()
    UPROPERTY(EditAnywhere, BlueprintReadWrite) float Approval = 52.f;
    UPROPERTY(EditAnywhere, BlueprintReadWrite) float Capital = 50.f;
    UPROPERTY(EditAnywhere, BlueprintReadWrite) float HouseSupport = 52.f;
    UPROPERTY(EditAnywhere, BlueprintReadWrite) float SenateSupport = 51.f;
    UPROPERTY(EditAnywhere, BlueprintReadWrite) float Media = 50.f;
    UPROPERTY(EditAnywhere, BlueprintReadWrite) float Party = 60.f;
    UPROPERTY(EditAnywhere, BlueprintReadWrite) float Scandal = 0.f;
};
USTRUCT(BlueprintType)
struct FPersonalState {
    GENERATED_BODY()
    UPROPERTY(EditAnywhere, BlueprintReadWrite) float Health = 80.f;
    UPROPERTY(EditAnywhere, BlueprintReadWrite) float Stress = 35.f;
    UPROPERTY(EditAnywhere, BlueprintReadWrite) float Marriage = 65.f;
    UPROPERTY(EditAnywhere, BlueprintReadWrite) float FamilyBond = 65.f;
    UPROPERTY(EditAnywhere, BlueprintReadWrite) float Integrity = 70.f;
    UPROPERTY(EditAnywhere, BlueprintReadWrite) float SleepDebt = 20.f;
    UPROPERTY(EditAnywhere, BlueprintReadWrite) float Fitness = 60.f;
};
USTRUCT(BlueprintType)
struct FFamilyMemberState {
    GENERATED_BODY()
    UPROPERTY(EditAnywhere, BlueprintReadWrite) FName Id;
    UPROPERTY(EditAnywhere, BlueprintReadWrite) FString Name;
    UPROPERTY(EditAnywhere, BlueprintReadWrite) FString Role;
    UPROPERTY(EditAnywhere, BlueprintReadWrite) float Bond = 60.f;
    UPROPERTY(EditAnywhere, BlueprintReadWrite) int32 MonthsNeglected = 0;
};
USTRUCT(BlueprintType)
struct FBudgetState {
    GENERATED_BODY()
    UPROPERTY(EditAnywhere, BlueprintReadWrite) TMap<FName, float> Proposed;
    UPROPERTY(EditAnywhere, BlueprintReadWrite) TMap<FName, float> Enacted;
};
USTRUCT(BlueprintType)
struct FCrisisState {
    GENERATED_BODY()
    UPROPERTY(EditAnywhere, BlueprintReadWrite) FName Id;
    UPROPERTY(EditAnywhere, BlueprintReadWrite) FString Title;
    UPROPERTY(EditAnywhere, BlueprintReadWrite) float Severity = 50.f;
    UPROPERTY(EditAnywhere, BlueprintReadWrite) bool bPendingDecision = true;
};
USTRUCT(BlueprintType)
struct FBillState {
    GENERATED_BODY()
    UPROPERTY(EditAnywhere, BlueprintReadWrite) FName Id;
    UPROPERTY(EditAnywhere, BlueprintReadWrite) FString Title;
    UPROPERTY(EditAnywhere, BlueprintReadWrite) float CapitalCost = 10.f;
    UPROPERTY(EditAnywhere, BlueprintReadWrite) float SupportRequired = 50.f;
    UPROPERTY(EditAnywhere, BlueprintReadWrite) bool bPassed = false;
    UPROPERTY(EditAnywhere, BlueprintReadWrite) bool bFailed = false;
};
USTRUCT(BlueprintType)
struct FPresidentialGameState {
    GENERATED_BODY()
    UPROPERTY(EditAnywhere, BlueprintReadWrite) int32 Seed = 1;
    UPROPERTY(EditAnywhere, BlueprintReadWrite) FString PresidentName;
    UPROPERTY(EditAnywhere, BlueprintReadWrite) int32 Month = 1;
    UPROPERTY(EditAnywhere, BlueprintReadWrite) int32 TermMonth = 1;
    UPROPERTY(EditAnywhere, BlueprintReadWrite) int32 ActionPoints = 3;
    UPROPERTY(EditAnywhere, BlueprintReadWrite) int32 MaxActionPoints = 3;
    UPROPERTY(EditAnywhere, BlueprintReadWrite) EGamePhase Phase = EGamePhase::Playing;
    UPROPERTY(EditAnywhere, BlueprintReadWrite) EEndingType Ending = EEndingType::None;
    UPROPERTY(EditAnywhere, BlueprintReadWrite) FNationalState Nation;
    UPROPERTY(EditAnywhere, BlueprintReadWrite) FPoliticalState Politics;
    UPROPERTY(EditAnywhere, BlueprintReadWrite) FPersonalState Personal;
    UPROPERTY(EditAnywhere, BlueprintReadWrite) FBudgetState Budget;
    UPROPERTY(EditAnywhere, BlueprintReadWrite) TArray<FFamilyMemberState> Family;
    UPROPERTY(EditAnywhere, BlueprintReadWrite) TArray<FCrisisState> PendingCrises;
    UPROPERTY(EditAnywhere, BlueprintReadWrite) TArray<FBillState> Bills;
};
USTRUCT(BlueprintType)
struct FPresidentialAction {
    GENERATED_BODY()
    UPROPERTY(EditAnywhere, BlueprintReadWrite) FName Id;
    UPROPERTY(EditAnywhere, BlueprintReadWrite) EStationCategory Station = EStationCategory::ResoluteDesk;
    UPROPERTY(EditAnywhere, BlueprintReadWrite) int32 ActionPointCost = 1;
    UPROPERTY(EditAnywhere, BlueprintReadWrite) float PoliticalCapitalCost = 0.f;
    UPROPERTY(EditAnywhere, BlueprintReadWrite) float ApprovalDelta = 0.f;
    UPROPERTY(EditAnywhere, BlueprintReadWrite) float StressDelta = 0.f;
    UPROPERTY(EditAnywhere, BlueprintReadWrite) float HealthDelta = 0.f;
};