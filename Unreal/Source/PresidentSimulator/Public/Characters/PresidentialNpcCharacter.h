#pragma once
#include "CoreMinimal.h"
#include "GameFramework/Character.h"
#include "PresidentialNpcCharacter.generated.h"
UENUM(BlueprintType) enum class ENpcQualityTier : uint8 { Hero, Supporting, Crowd };
UCLASS(Blueprintable)
class PRESIDENTSIMULATOR_API APresidentialNpcCharacter : public ACharacter {
    GENERATED_BODY()
public:
    UPROPERTY(EditAnywhere, BlueprintReadWrite) FName NarrativeRole;
    UPROPERTY(EditAnywhere, BlueprintReadWrite) ENpcQualityTier QualityTier = ENpcQualityTier::Supporting;
    UPROPERTY(EditAnywhere, BlueprintReadWrite) bool bDialogueFocused = false;
    UFUNCTION(BlueprintImplementableEvent, Category="Facial") void ApplyFacialCurve(FName CurveName, float Value);
    UFUNCTION(BlueprintImplementableEvent, Category="Facial") void SetDialogueFocus(bool bFocused);
};