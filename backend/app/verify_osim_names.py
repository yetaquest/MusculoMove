from pathlib import Path
import opensim as osim

MODEL_FILENAME = "Arnoldetal2010_2Legs_Default_v2.1.osim"


def find_model_file() -> Path:
    project_root = Path(__file__).resolve().parents[2]

    matches = list(project_root.rglob(MODEL_FILENAME))
    if not matches:
        raise FileNotFoundError(
            f"Could not find {MODEL_FILENAME} anywhere under {project_root}.\n"
            "Move the extracted OpenSim model folder into your project first."
        )

    if len(matches) > 1:
        print("Multiple matches found. Using the first one:")
        for m in matches:
            print(f"  - {m}")

    return matches[0]


def main() -> None:
    print("SCRIPT STARTED")

    osim_path = find_model_file()

    print(f"Loading model: {osim_path}")
    model = osim.Model(str(osim_path))
    _state = model.initSystem()

    print("\n=== MODEL NAME ===")
    print(model.getName())

    print("\n=== COORDINATES ===")
    coords = model.getCoordinateSet()
    print(f"Total coordinates: {coords.getSize()}")
    for i in range(coords.getSize()):
        coord = coords.get(i)
        print(f"{i:>2}: {coord.getName()}")

    print("\n=== MUSCLES ===")
    muscles = model.getMuscles()
    print(f"Total muscles: {muscles.getSize()}")
    for i in range(muscles.getSize()):
        muscle = muscles.get(i)
        print(f"{i:>2}: {muscle.getName()}")


if __name__ == "__main__":
    main()
