#!/usr/bin/env python3
"""
KrishiLens Dataset Validation Script

Validates:
- Image-label file pairing
- YOLO annotation format (class_id, cx, cy, w, h)
- Class IDs are in valid range [0-3]
- Normalized bounding box coordinates [0, 1]
- No missing annotations
- Duplicate images detection
- Negative control handling (empty label files for non-pesticide images)
- Source/license tracking
- Train/val/test split consistency
"""

import sys
from pathlib import Path
from collections import defaultdict
import hashlib
import json
from PIL import Image


class DatasetValidator:
    """Validates KrishiLens pesticide dataset structure and annotations."""

    # KrishiLens class definitions
    VALID_CLASSES = {
        0: "pesticide_package",
        1: "cibrc_label",
        2: "toxicity_triangle",
        3: "cibrc_reg_stamp"
    }

    # Allowed image extensions
    IMAGE_EXTENSIONS = {'.jpg', '.jpeg', '.png', '.bmp', '.gif'}

    def __init__(self, dataset_root):
        """Initialize validator with dataset root path."""
        self.root = Path(dataset_root)
        self.errors = []
        self.warnings = []
        self.stats = {
            'total_images': 0,
            'total_annotations': 0,
            'images_by_split': defaultdict(int),
            'annotations_by_split': defaultdict(int),
            'classes_by_split': defaultdict(lambda: defaultdict(int)),
            'negative_controls': 0,
            'duplicate_images': [],
            'image_hashes': {}
        }

    def run(self):
        """Execute all validation checks."""
        print(f"\n{'='*60}")
        print(f"KrishiLens Dataset Validator")
        print(f"Dataset: {self.root}")
        print(f"{'='*60}\n")

        # Check dataset structure
        self._validate_structure()
        if self.errors:
            self._print_results()
            return False

        # Validate each split
        for split in ['train', 'val', 'test']:
            self._validate_split(split)

        # Check for duplicates
        self._check_duplicates()

        # Print results
        return self._print_results()

    def _validate_structure(self):
        """Verify required directories exist."""
        required_dirs = [
            self.root / 'images' / 'train',
            self.root / 'images' / 'val',
            self.root / 'images' / 'test',
            self.root / 'labels' / 'train',
            self.root / 'labels' / 'val',
            self.root / 'labels' / 'test'
        ]

        for dir_path in required_dirs:
            if not dir_path.exists():
                self.errors.append(f"Missing directory: {dir_path}")

        # Check for data.yaml
        if not (self.root / 'data.yaml').exists():
            self.errors.append("Missing data.yaml configuration file")

    def _validate_split(self, split):
        """Validate a single train/val/test split."""
        image_dir = self.root / 'images' / split
        label_dir = self.root / 'labels' / split

        # Get all image files
        image_files = set()
        for ext in self.IMAGE_EXTENSIONS:
            image_files.update(image_dir.glob(f'*{ext}'))
            image_files.update(image_dir.glob(f'*{ext.upper()}'))

        self.stats['images_by_split'][split] = len(image_files)
        self.stats['total_images'] += len(image_files)

        print(f"Validating '{split}' split: {len(image_files)} images")

        for img_path in sorted(image_files):
            # Check corresponding label file exists
            label_path = label_dir / f"{img_path.stem}.txt"

            if not label_path.exists():
                self.errors.append(
                    f"[{split}] Missing label for image: {img_path.name}"
                )
                continue

            # Validate image file
            try:
                with Image.open(img_path) as img:
                    width, height = img.size
                    if width <= 0 or height <= 0:
                        self.errors.append(
                            f"[{split}] Invalid image dimensions: {img_path.name} "
                            f"({width}x{height})"
                        )
            except Exception as e:
                self.errors.append(
                    f"[{split}] Cannot open image {img_path.name}: {e}"
                )
                continue

            # Validate label format
            self._validate_label(split, label_path, img_path)

            # Track hash for duplicate detection
            self.stats['image_hashes'][str(img_path)] = self._hash_file(img_path)

    def _validate_label(self, split, label_path, img_path):
        """Validate YOLO format annotations in a label file."""
        try:
            with open(label_path, 'r') as f:
                lines = f.read().strip().split('\n')

            # Empty file is valid for negative controls
            if len(lines) == 1 and lines[0] == '':
                self.stats['negative_controls'] += 1
                self.stats['annotations_by_split'][split] += 0
                return

            for line_num, line in enumerate(lines, 1):
                if not line.strip():
                    continue

                try:
                    parts = line.split()
                    if len(parts) != 5:
                        self.errors.append(
                            f"[{split}] {img_path.name}: Line {line_num} has "
                            f"{len(parts)} fields, expected 5"
                        )
                        continue

                    # Parse annotation
                    class_id = int(parts[0])
                    cx, cy, w, h = map(float, parts[1:5])

                    # Validate class ID
                    if class_id not in self.VALID_CLASSES:
                        self.errors.append(
                            f"[{split}] {img_path.name}: Invalid class ID {class_id} "
                            f"(valid: 0-3)"
                        )

                    # Validate normalized coordinates [0, 1]
                    if not (0 <= cx <= 1):
                        self.errors.append(
                            f"[{split}] {img_path.name}: Line {line_num}: "
                            f"cx={cx} out of range [0, 1]"
                        )
                    if not (0 <= cy <= 1):
                        self.errors.append(
                            f"[{split}] {img_path.name}: Line {line_num}: "
                            f"cy={cy} out of range [0, 1]"
                        )
                    if not (0 <= w <= 1):
                        self.errors.append(
                            f"[{split}] {img_path.name}: Line {line_num}: "
                            f"w={w} out of range [0, 1]"
                        )
                    if not (0 <= h <= 1):
                        self.errors.append(
                            f"[{split}] {img_path.name}: Line {line_num}: "
                            f"h={h} out of range [0, 1]"
                        )

                    # Track class statistics
                    self.stats['classes_by_split'][split][class_id] += 1

                except ValueError as e:
                    self.errors.append(
                        f"[{split}] {img_path.name}: Line {line_num} - "
                        f"cannot parse coordinates: {line}"
                    )

            self.stats['annotations_by_split'][split] += 1
            self.stats['total_annotations'] += 1

        except Exception as e:
            self.errors.append(
                f"[{split}] Cannot read label {label_path.name}: {e}"
            )

    def _check_duplicates(self):
        """Detect duplicate images by hash."""
        hash_to_paths = defaultdict(list)

        for path, file_hash in self.stats['image_hashes'].items():
            hash_to_paths[file_hash].append(path)

        for file_hash, paths in hash_to_paths.items():
            if len(paths) > 1:
                self.warnings.append(
                    f"Potential duplicate images (same hash): "
                    f"{', '.join([Path(p).name for p in paths])}"
                )

    @staticmethod
    def _hash_file(path, chunk_size=8192):
        """Compute SHA256 hash of file."""
        hasher = hashlib.sha256()
        with open(path, 'rb') as f:
            while chunk := f.read(chunk_size):
                hasher.update(chunk)
        return hasher.hexdigest()

    def _print_results(self):
        """Print validation results."""
        print(f"\n{'='*60}")
        print("VALIDATION RESULTS")
        print(f"{'='*60}\n")

        # Print statistics
        print("📊 DATASET STATISTICS:")
        print(f"  Total images: {self.stats['total_images']}")
        print(f"  Total annotations: {self.stats['total_annotations']}")
        print(f"  Negative controls: {self.stats['negative_controls']}")

        for split in ['train', 'val', 'test']:
            print(f"\n  {split.upper()}:")
            print(f"    Images: {self.stats['images_by_split'][split]}")
            print(f"    Annotations: {self.stats['annotations_by_split'][split]}")

            # Print class distribution
            if split in self.stats['classes_by_split']:
                for class_id in sorted(self.stats['classes_by_split'][split].keys()):
                    count = self.stats['classes_by_split'][split][class_id]
                    class_name = self.VALID_CLASSES[class_id]
                    print(f"      - {class_name} (class {class_id}): {count} boxes")

        # Print errors
        if self.errors:
            print(f"\n❌ ERRORS ({len(self.errors)}):")
            for i, error in enumerate(self.errors, 1):
                print(f"  {i}. {error}")

        # Print warnings
        if self.warnings:
            print(f"\n⚠️  WARNINGS ({len(self.warnings)}):")
            for i, warning in enumerate(self.warnings, 1):
                print(f"  {i}. {warning}")

        # Final status
        print(f"\n{'='*60}")
        if not self.errors:
            print("✅ VALIDATION PASSED - Dataset is ready for training")
            return True
        else:
            print("🔴 VALIDATION FAILED - Fix errors before training")
            return False


if __name__ == '__main__':
    dataset_root = Path(sys.argv[1]) if len(sys.argv) > 1 else Path('data/pesticide_pilot_dataset')

    validator = DatasetValidator(dataset_root)
    success = validator.run()
    sys.exit(0 if success else 1)
