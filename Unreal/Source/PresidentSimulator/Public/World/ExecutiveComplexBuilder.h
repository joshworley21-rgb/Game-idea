#pragma once
#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "ExecutiveComplexBuilder.generated.h"
UCLASS(Blueprintable)
class PRESIDENTSIMULATOR_API AExecutiveComplexBuilder : public AActor {
    GENERATED_BODY()
public:
    AExecutiveComplexBuilder();
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category="Blockout") bool bBuildOnBeginPlay = false;
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category="Blockout") float RoomScale = 1.f;
    UFUNCTION(BlueprintCallable, CallInEditor, Category="Blockout") void BuildComplex();
    UFUNCTION(BlueprintCallable, CallInEditor, Category="Blockout") void ClearComplex();
protected:
    virtual void BeginPlay() override;
private:
    UPROPERTY(Transient) TArray<TObjectPtr<AActor>> SpawnedActors;
    void BuildRoom(const FString& Label, const FVector& Location, const FVector& Extent);
};