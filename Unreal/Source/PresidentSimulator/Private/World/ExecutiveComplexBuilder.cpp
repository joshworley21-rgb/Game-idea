#include "World/ExecutiveComplexBuilder.h"
#include "World/PresidentialStation.h"
#include "World/RoomPortal.h"
#include "Components/StaticMeshComponent.h"
#include "Engine/StaticMesh.h"
#include "UObject/ConstructorHelpers.h"
AExecutiveComplexBuilder::AExecutiveComplexBuilder() { PrimaryActorTick.bCanEverTick = false; }
void AExecutiveComplexBuilder::BeginPlay() { Super::BeginPlay(); if (bBuildOnBeginPlay) BuildComplex(); }
void AExecutiveComplexBuilder::ClearComplex() { for (AActor* Actor : SpawnedActors) if (IsValid(Actor)) Actor->Destroy(); SpawnedActors.Empty(); }
void AExecutiveComplexBuilder::BuildRoom(const FString& Label, const FVector& Location, const FVector& Extent) {
    UStaticMesh* Cube = LoadObject<UStaticMesh>(nullptr, TEXT("/Engine/BasicShapes/Cube.Cube"));
    AActor* Room = GetWorld()->SpawnActor<AActor>(AActor::StaticClass(), Location, FRotator::ZeroRotator); SpawnedActors.Add(Room);
    auto AddBlock = [&](FVector Offset, FVector Scale) { UStaticMeshComponent* Mesh = NewObject<UStaticMeshComponent>(Room); Mesh->RegisterComponent(); Mesh->SetStaticMesh(Cube); Mesh->AttachToComponent(Room->GetRootComponent(), FAttachmentTransformRules::KeepRelativeTransform); Mesh->SetRelativeLocation(Offset); Mesh->SetRelativeScale3D(Scale / 100.f); };
    UStaticMeshComponent* Root = NewObject<UStaticMeshComponent>(Room); Room->SetRootComponent(Root); Root->RegisterComponent(); Root->SetStaticMesh(Cube); Root->SetRelativeScale3D(FVector(Extent.X, Extent.Y, 10.f) / 100.f);
    AddBlock(FVector(0, -Extent.Y, Extent.Z), FVector(Extent.X * 2, 20, Extent.Z * 2)); AddBlock(FVector(0, Extent.Y, Extent.Z), FVector(Extent.X * 2, 20, Extent.Z * 2));
    AddBlock(FVector(-Extent.X, 0, Extent.Z), FVector(20, Extent.Y * 2, Extent.Z * 2)); AddBlock(FVector(Extent.X, 0, Extent.Z), FVector(20, Extent.Y * 2, Extent.Z * 2));
}
void AExecutiveComplexBuilder::BuildComplex() {
    ClearComplex();
    const float S = RoomScale;
    const TArray<FString> RoomNames = { TEXT("Oval Office"), TEXT("Cabinet Room"), TEXT("Capitol Chamber"), TEXT("Press Room"), TEXT("Residence"), TEXT("Private Study") };
    TArray<FVector> RoomLocations;
    for (int32 Index = 0; Index < RoomNames.Num(); ++Index) {
        const FVector Location(Index * 1200.f * S, 0, 0);
        RoomLocations.Add(Location);
        BuildRoom(RoomNames[Index], Location, FVector(500, 400, 250) * S);
    }
    auto AddStation = [this](const FVector& Location, EStationCategory Category, const TCHAR* Label) {
        APresidentialStation* Station = GetWorld()->SpawnActor<APresidentialStation>(Location, FRotator::ZeroRotator);
        Station->Category = Category; Station->DisplayName = FText::FromString(Label); SpawnedActors.Add(Station);
    };
    // Oval: desk and secure line. Cabinet: budget and West Wing staff.
    AddStation(RoomLocations[0] + FVector(-120.f * S, 0, 10), EStationCategory::ResoluteDesk, TEXT("Resolute Desk"));
    AddStation(RoomLocations[0] + FVector(130.f * S, 120.f * S, 10), EStationCategory::SecureLine, TEXT("Secure Line"));
    AddStation(RoomLocations[1] + FVector(-120.f * S, -80.f * S, 10), EStationCategory::CabinetBudget, TEXT("Cabinet & Budget"));
    AddStation(RoomLocations[1] + FVector(140.f * S, 100.f * S, 10), EStationCategory::StaffWestWing, TEXT("Staff & West Wing"));
    AddStation(RoomLocations[2] + FVector(0, 0, 10), EStationCategory::CongressFloor, TEXT("Congress Floor"));
    AddStation(RoomLocations[3] + FVector(0, 0, 10), EStationCategory::PressPool, TEXT("Press Pool"));
    AddStation(RoomLocations[4] + FVector(0, 0, 10), EStationCategory::Residence, TEXT("Residence"));
    AddStation(RoomLocations[5] + FVector(0, 0, 10), EStationCategory::PrivateStudy, TEXT("Private Study"));
    // Each neighboring room has two independently usable portals. Arrival offsets keep pawns clear of the trigger.
    for (int32 Index = 0; Index < RoomLocations.Num() - 1; ++Index) {
        const FVector ForwardLocation = RoomLocations[Index] + FVector(420.f * S, 0, 10);
        const FVector BackLocation = RoomLocations[Index + 1] - FVector(420.f * S, 0, -10);
        ARoomPortal* Forward = GetWorld()->SpawnActor<ARoomPortal>(ForwardLocation, FRotator::ZeroRotator);
        Forward->DestinationTag = FName(*RoomNames[Index + 1]); Forward->DestinationLabel = FText::Format(NSLOCTEXT("PresidentSimulator", "EnterRoom", "Enter {0}"), FText::FromString(RoomNames[Index + 1]));
        Forward->DestinationTransform = FTransform(FRotator(0, 180, 0), BackLocation + FVector(-90.f * S, 0, 0));
        SpawnedActors.Add(Forward);
        ARoomPortal* Back = GetWorld()->SpawnActor<ARoomPortal>(BackLocation, FRotator(0, 180, 0));
        Back->DestinationTag = FName(*RoomNames[Index]); Back->DestinationLabel = FText::Format(NSLOCTEXT("PresidentSimulator", "ReturnRoom", "Return to {0}"), FText::FromString(RoomNames[Index]));
        Back->DestinationTransform = FTransform(FRotator::ZeroRotator, ForwardLocation + FVector(90.f * S, 0, 0));
        SpawnedActors.Add(Back);
    }
}