#pragma once
#include "CoreMinimal.h"
#include "GameFramework/Character.h"
#include "PresidentCharacter.generated.h"
class UCameraComponent; class USpringArmComponent; class UInputMappingContext; class UInputAction; struct FInputActionValue;
UCLASS()
class PRESIDENTSIMULATOR_API APresidentCharacter : public ACharacter {
    GENERATED_BODY()
public:
    APresidentCharacter();
    virtual void SetupPlayerInputComponent(UInputComponent* PlayerInputComponent) override;
    virtual void BeginPlay() override;
    UPROPERTY(VisibleAnywhere, BlueprintReadOnly) TObjectPtr<UCameraComponent> FirstPersonCamera;
    UPROPERTY(EditDefaultsOnly, Category="Input") TObjectPtr<UInputMappingContext> DefaultMappingContext;
    UPROPERTY(EditDefaultsOnly, Category="Input") TObjectPtr<UInputAction> MoveAction;
    UPROPERTY(EditDefaultsOnly, Category="Input") TObjectPtr<UInputAction> LookAction;
    UPROPERTY(EditDefaultsOnly, Category="Input") TObjectPtr<UInputAction> SprintAction;
    UPROPERTY(EditDefaultsOnly, Category="Input") TObjectPtr<UInputAction> InteractAction;
    UPROPERTY(EditDefaultsOnly, Category="Input") TObjectPtr<UInputAction> DashboardAction;
    UPROPERTY(BlueprintReadOnly) TObjectPtr<AActor> NearbyInteractable;
    UFUNCTION(BlueprintCallable) void TryInteract();
    UFUNCTION(BlueprintImplementableEvent) void OpenDashboard();
private:
    void Move(const FInputActionValue& Value); void Look(const FInputActionValue& Value); void StartSprint(); void StopSprint(); void UpdateNearbyInteractable();
    float WalkSpeed = 350.f; float SprintSpeed = 600.f;
};