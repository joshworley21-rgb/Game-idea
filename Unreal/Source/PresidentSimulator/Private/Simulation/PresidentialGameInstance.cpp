#include "Simulation/PresidentialGameInstance.h"

static float ClampIndex(float Value) { return FMath::Clamp(Value, 0.f, 100.f); }
void UPresidentialGameInstance::StartNewGame(const FString& PresidentName, int32 Seed) {
    State = FPresidentialGameState(); State.Seed = Seed; State.PresidentName = PresidentName.IsEmpty() ? TEXT("President") : PresidentName;
    for (const TCHAR* Key : { TEXT("Defense"), TEXT("Healthcare"), TEXT("Education"), TEXT("Infrastructure"), TEXT("Environment"), TEXT("Science"), TEXT("Welfare"), TEXT("Justice"), TEXT("Veterans") }) {
        State.Budget.Proposed.Add(Key, 100.f); State.Budget.Enacted.Add(Key, 100.f); State.Nation.SectorQuality.Add(Key, 55.f);
    }
    State.Family = { {TEXT("spouse"), TEXT("Spouse"), TEXT("Spouse"), 68.f, 0}, {TEXT("child"), TEXT("Child"), TEXT("Child"), 62.f, 0} };
    State.Bills = { {TEXT("infrastructure"), TEXT("National Infrastructure Act"), 12.f, 52.f, false, false} };
    BroadcastState();
}
bool UPresidentialGameInstance::PerformAction(const FPresidentialAction& Action, FString& OutReason) {
    if (State.Phase != EGamePhase::Playing) { OutReason = TEXT("The term has ended."); return false; }
    if (Action.ActionPointCost < 0 || Action.ActionPointCost > State.ActionPoints || Action.PoliticalCapitalCost < 0.f || Action.PoliticalCapitalCost > State.Politics.Capital) { OutReason = TEXT("Insufficient action points or political capital."); return false; }
    State.ActionPoints -= Action.ActionPointCost; State.Politics.Capital = ClampIndex(State.Politics.Capital - Action.PoliticalCapitalCost);
    State.Politics.Approval = ClampIndex(State.Politics.Approval + Action.ApprovalDelta); State.Personal.Stress = ClampIndex(State.Personal.Stress + Action.StressDelta); State.Personal.Health = ClampIndex(State.Personal.Health + Action.HealthDelta);
    OutReason = FString::Printf(TEXT("%s completed."), *Action.Id.ToString()); OnActionResolved.Broadcast(OutReason); BroadcastState(); return true;
}
bool UPresidentialGameInstance::ProposeBill(FName BillId, float ExtraCapital, FString& OutReason) {
    FBillState* Bill = State.Bills.FindByPredicate([BillId](const FBillState& Candidate) { return Candidate.Id == BillId; });
    if (!Bill || Bill->bPassed || Bill->bFailed || State.ActionPoints < 1 || ExtraCapital < 0.f || State.Politics.Capital < Bill->CapitalCost + ExtraCapital) { OutReason = TEXT("Bill cannot be brought to the floor."); return false; }
    State.ActionPoints--; State.Politics.Capital -= Bill->CapitalCost + ExtraCapital; const bool bPass = (State.Politics.HouseSupport + State.Politics.SenateSupport) * .5f + ExtraCapital >= Bill->SupportRequired;
    Bill->bPassed = bPass; Bill->bFailed = !bPass; State.Politics.Approval = ClampIndex(State.Politics.Approval + (bPass ? 2.f : -2.f)); OutReason = bPass ? TEXT("Bill passed.") : TEXT("Bill failed."); BroadcastState(); return true;
}
bool UPresidentialGameInstance::ResolveCrisis(FName CrisisId, bool bStrongResponse, FString& OutReason) {
    const int32 Index = State.PendingCrises.IndexOfByPredicate([CrisisId](const FCrisisState& Crisis) { return Crisis.Id == CrisisId; });
    if (Index == INDEX_NONE) { OutReason = TEXT("No matching pending crisis."); return false; }
    FCrisisState Crisis = State.PendingCrises[Index]; const float Cost = bStrongResponse ? 12.f : 4.f;
    if (State.Politics.Capital < Cost) { OutReason = TEXT("Insufficient political capital."); return false; }
    State.Politics.Capital -= Cost; State.Politics.Approval = ClampIndex(State.Politics.Approval + (bStrongResponse ? 2.f : -1.f)); State.PendingCrises.RemoveAt(Index); OutReason = TEXT("Crisis response recorded."); BroadcastState(); return true;
}
bool UPresidentialGameInstance::AdvanceMonth(FString& OutReason) {
    if (State.Phase != EGamePhase::Playing || State.PendingCrises.Num()) { OutReason = TEXT("Resolve pending crises before advancing."); return false; }
    RecalculateApproval(); State.Month++; State.TermMonth++; State.ActionPoints = State.MaxActionPoints;
    State.Personal.Stress = ClampIndex(State.Personal.Stress + 4.f); State.Personal.Health = ClampIndex(State.Personal.Health - FMath::Max(0.f, (State.Personal.Stress - 70.f) * .08f));
    for (FFamilyMemberState& Member : State.Family) { Member.MonthsNeglected++; Member.Bond = ClampIndex(Member.Bond - 1.f); }
    if (State.TermMonth % 3 == 0) { FCrisisState& Crisis = State.PendingCrises.AddDefaulted_GetRef(); Crisis.Id = FName(*FString::Printf(TEXT("brief_%d"), State.Month)); Crisis.Title = TEXT("National Security Brief"); Crisis.Severity = 40.f; OnCrisisRaised.Broadcast(Crisis); }
    if (State.Personal.Health <= 10.f) Finish(EEndingType::Incapacitated); else if (State.TermMonth > 48) Finish(State.Politics.Approval >= 50.f ? EEndingType::Reelected : EEndingType::Defeated);
    OutReason = TEXT("Month advanced."); BroadcastState(); return true;
}
void UPresidentialGameInstance::RecalculateApproval() { State.Politics.Approval = ClampIndex(50.f + (State.Nation.Growth - 2.f) * 2.f - (State.Nation.Unemployment - 4.f) * 1.5f - (State.Nation.Inflation - 2.f) - State.Politics.Scandal * .25f + (State.Personal.Integrity - 50.f) * .08f); }
void UPresidentialGameInstance::Finish(EEndingType Type) { State.Phase = EGamePhase::Ended; State.Ending = Type; }
void UPresidentialGameInstance::BroadcastState() { OnStateChanged.Broadcast(State); }