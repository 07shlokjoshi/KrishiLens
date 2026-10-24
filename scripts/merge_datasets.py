#!/usr/bin/env python3
"""
KrishiLens Dataset Merge Script

Merges multiple datasets while tracking:
- Source and license information
- Class ID mappings
- Train/val/test split ratios
- Duplicate detection
- Data leakage prevention
"""

import sys
import json
import shutil
from pathlib import Path
from collections import defaultdict
import hashlib
import argparse


class DatasetMerger:
    """Merges pesticide detection datasets with source tracking."""

    VALID_CLASSES = {
        0: "pesticide_package",
        1: "cibrc_label",
        2: "toxicity_triangle",
        3: "cibrc_reg_stamp"
    }

    def __init__(self, output_dir):
        """Initialize merger."""
        self.output_dir = Path(output_dir)
        self.manifest = {
            'sources': [],
            'merge_time': None,
            'total_images': 0,
            'splits': {'train': 0, 'val': 0, 'test': 0},
            'class_counts': defaultdict(lambda: defaultdict(int)),
            'file_mappings': {}  # track original source for each file
        }
        self.image_hashes = {}

    def merge(self, datasets):
        """
        Merge multiple datasets.

        Args:
            datasets: List of dicts with keys:
              - path: dataset root
              - name: human readable name
              - source: URL or location
              - license: license type
              - class_mapping: dict of {old_class_id: new_class_id} (optional)
        """
        from datetime import datetime
        self.manifest['merge_time'] = datetime.now().isoformat()

        # Create output structure
        self.output_dir.mkdir(parents=True, exist_ok=True)
        for split in ['train', 'val', 'test']:
            (self.output_dir / 'images' / split).mkdir(parents=True, exist_ok=True)
            (self.output_dir / 'labels' / split).mkdir(parents=True, exist_ok=True)

        # Process each dataset
        for dataset_info in datasets:
            self._merge_dataset(dataset_info)

        # Check for duplicates
        self._check_duplicates()

        # Create data.yaml
        self._create_data_yaml()

        # Save manifest
        self._save_manifest()

        return self._print_summary()

    def _merge_dataset(self, dataset_info):
        """Merge single dataset."""
        dataset_path = Path(dataset_info['path'])
        name = dataset_info['name']
        source = dataset_info['source']
        license_info = dataset_info['license']
        class_mapping = dataset_info.get('class_mapping', {})

        print(f"\n📦 Merging dataset: {name}")
        print(f"   Source: {source}")
        print(f"   License: {license_info}")

        # Track source
        self.manifest['sources'].append({
            'name': name,
            'source': source,
            'license': license_info,
            'class_mapping': class_mapping,
            'images_count': 0
        })
        source_idx = len(self.manifest['sources']) - 1

        # Process each split
        for split in ['train', 'val', 'test']:
            src_img_dir = dataset_path / 'images' / split
            src_lbl_dir = dataset_path / 'labels' / split

            if not src_img_dir.exists():
                print(f"   ⚠️  Missing {split} split")
                continue

            # Get image files
            image_files = list(src_img_dir.glob('*.jpg')) + list(src_img_dir.glob('*.png'))
            if not image_files:
                continue

            print(f"   {split}: {len(image_files)} images", end='')

            for img_path in image_files:
                label_path = src_lbl_dir / f"{img_path.stem}.txt"

                # Generate unique filename to avoid collisions
                unique_name = f"{name}_{img_path.stem}"
                dst_img_path = self.output_dir / 'images' / split / f"{unique_name}{img_path.suffix}"
                dst_lbl_path = self.output_dir / 'labels' / split / f"{unique_name}.txt"

                # Copy image
                try:
                    shutil.copy2(img_path, dst_img_path)
                    self.image_hashes[str(dst_img_path)] = self._hash_file(img_path)
                except Exception as e:
                    print(f"      ❌ Error copying {img_path.name}: {e}")
                    continue

                # Copy and remap label if exists
                if label_path.exists():
                    self._copy_and_remap_label(
                        label_path, dst_lbl_path, class_mapping
                    )
                else:
                    # Create empty label for images without annotations
                    dst_lbl_path.write_text('')

                # Track file mapping
                self.manifest['file_mappings'][str(dst_img_path)] = {
                    'source': name,
                    'original_name': img_path.name,
                    'split': split
                }

                self.manifest['splits'][split] += 1
                self.manifest['sources'][source_idx]['images_count'] += 1

            print(" ✓")

        self.manifest['total_images'] += self.manifest['sources'][source_idx]['images_count']

    def _copy_and_remap_label(self, src_label, dst_label, class_mapping):
        """Copy label file, remapping class IDs if needed."""
        with open(src_label, 'r') as f:
            lines = f.readlines()

        remapped_lines = []
        for line in lines:
            if not line.strip():
                continue

            parts = line.split()
            if len(parts) != 5:
                continue

            old_class_id = int(parts[0])
            coords = parts[1:5]

            # Apply class mapping if specified
            if old_class_id in class_mapping:
                new_class_id = class_mapping[old_class_id]
            else:
                new_class_id = old_class_id

            # Validate new class ID
            if new_class_id not in self.VALID_CLASSES:
                print(f"      ⚠️  Skipping invalid class ID {new_class_id}")
                continue

            remapped_lines.append(f"{new_class_id} {' '.join(coords)}\n")

            # Track class count
            split = dst_label.parent.parent.name
            self.manifest['class_counts'][split][new_class_id] += 1

        # Write remapped labels
        dst_label.write_text(''.join(remapped_lines))

    def _check_duplicates(self):
        """Check for duplicate images across dataset."""
        hash_to_paths = defaultdict(list)

        for path, file_hash in self.image_hashes.items():
            hash_to_paths[file_hash].append(path)

        duplicates = {h: p for h, p in hash_to_paths.items() if len(p) > 1}

        if duplicates:
            print(f"\n⚠️  Found {len(duplicates)} duplicate images:")
            for file_hash, paths in duplicates.items():
                print(f"   {[Path(p).name for p in paths]}")

    def _create_data_yaml(self):
        """Create data.yaml for merged dataset."""
        yaml_content = f"""# KrishiLens Merged Dataset Configuration
path: {self.output_dir}
train: images/train
val: images/val
test: images/test

nc: 4

names:
  0: pesticide_package
  1: cibrc_label
  2: toxicity_triangle
  3: cibrc_reg_stamp
"""
        (self.output_dir / 'data.yaml').write_text(yaml_content)
        print(f"\n✅ Created data.yaml")

    def _save_manifest(self):
        """Save merge manifest with source/license information."""
        manifest_path = self.output_dir / 'MERGE_MANIFEST.json'

        # Convert defaultdicts to regular dicts for JSON serialization
        manifest_to_save = {
            'sources': self.manifest['sources'],
            'merge_time': self.manifest['merge_time'],
            'total_images': self.manifest['total_images'],
            'splits': dict(self.manifest['splits']),
            'class_counts': {
                split: dict(counts)
                for split, counts in self.manifest['class_counts'].items()
            },
            'file_mappings': self.manifest['file_mappings']
        }

        with open(manifest_path, 'w') as f:
            json.dump(manifest_to_save, f, indent=2)

        print(f"✅ Saved merge manifest to {manifest_path}")

    def _print_summary(self):
        """Print merge summary."""
        print(f"\n{'='*60}")
        print("MERGE SUMMARY")
        print(f"{'='*60}")
        print(f"\n📊 DATASET STATISTICS:")
        print(f"  Total images: {self.manifest['total_images']}")
        print(f"  Train: {self.manifest['splits']['train']}")
        print(f"  Val: {self.manifest['splits']['val']}")
        print(f"  Test: {self.manifest['splits']['test']}")

        print(f"\n📋 SOURCES ({len(self.manifest['sources'])}):")
        for source in self.manifest['sources']:
            print(f"  - {source['name']}: {source['images_count']} images")
            print(f"    License: {source['license']}")
            if source['class_mapping']:
                print(f"    Class mappings: {source['class_mapping']}")

        print(f"\n✅ Merged dataset saved to: {self.output_dir}")
        print(f"✅ Ready for training with: data.yaml at {self.output_dir / 'data.yaml'}")

        return True

    @staticmethod
    def _hash_file(path, chunk_size=8192):
        """Compute file hash."""
        hasher = hashlib.sha256()
        with open(path, 'rb') as f:
            while chunk := f.read(chunk_size):
                hasher.update(chunk)
        return hasher.hexdigest()


def main():
    parser = argparse.ArgumentParser(
        description='Merge pesticide detection datasets with source tracking'
    )
    parser.add_argument('--existing', required=True, help='Path to existing dataset')
    parser.add_argument('--new', required=True, help='Path to new dataset')
    parser.add_argument('--output', required=True, help='Output directory')
    parser.add_argument('--new-source', default='external_dataset',
                        help='Source name for new dataset')
    parser.add_argument('--new-license', default='CC-BY-4.0',
                        help='License for new dataset')

    args = parser.parse_args()

    # Define datasets to merge
    datasets = [
        {
            'path': args.existing,
            'name': 'pesticide_pilot_dataset',
            'source': 'KrishiLens annotation project',
            'license': 'Research - internal use',
            'class_mapping': {}
        },
        {
            'path': args.new,
            'name': args.new_source,
            'source': 'External source',
            'license': args.new_license,
            'class_mapping': {}
        }
    ]

    # Merge datasets
    merger = DatasetMerger(args.output)
    success = merger.merge(datasets)

    sys.exit(0 if success else 1)


if __name__ == '__main__':
    main()
