#pragma once
#include "CoreMinimal.h"
#include "Components/ActorComponent.h"
#include "ConversationDirectorComponent.generated.h"
class APresidentialNpcCharacter;
UCLASS(ClassGroup=(Conversation), Blueprintable, meta=(BlueprintSpawnableComponent))
class PRESIDENTSIMULATOR_API UConversationDirectorComponent : public UActorComponent {
    GENERATED_BODY()
public:
    UPROPERTY(BlueprintReadOnly) TObjectPtr<APresidentialNpcCharacter> Speaker;
    UPROPERTY(BlueprintReadOnly) TObjectPtr<APresidentialNpcCharacter> Listener;
    UFUNCTION(BlueprintCallable) void FrameConversation(APresidentialNpcCharacter* InSpeaker, APresidentialNpcCharacter* InListener);
    UFUNCTION(BlueprintImplementableEvent) void OnConversationFrameRequested(APresidentialNpcCharacter* InSpeaker, APresidentialNpcCharacter* InListener);
    UFUNCTION(BlueprintImplementableEvent) void OnFacialAnimationRequested(APresidentialNpcCharacter* Target, FName Curve, float Value);
};