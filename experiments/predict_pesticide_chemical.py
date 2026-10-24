import sys
import joblib

def predict_chemical_class(smiles_string):
    model_path = "experiments/models/pesticide_chemical_classifier.joblib"
    bundle = joblib.load(model_path)
    
    vec = bundle["vectorizer"]
    model = bundle["model"]
    classes = bundle["classes"]

    X = vec.transform([smiles_string])
    pred = model.predict(X)[0]
    probs = model.predict_proba(X)[0]

    actual_classes = getattr(model, "classes_", classes)
    prob_dict = {cls: round(float(p), 4) for cls, p in zip(actual_classes, probs)}
    return {
        "smiles": smiles_string,
        "predicted_class": pred,
        "class_probabilities": prob_dict
    }

if __name__ == "__main__":
    # Test sample: Acetamiprid SMILES
    sample_smiles = "CC(=NC#N)N(C)CC1=CN=C(C=C1)Cl"
    if len(sys.argv) > 1:
        sample_smiles = sys.argv[1]

    res = predict_chemical_class(sample_smiles)
    print("Chemical Classification Inference:")
    print(f"  SMILES:    {res['smiles']}")
    print(f"  Predicted: {res['predicted_class']}")
    print(f"  Scores:    {res['class_probabilities']}")
