# rename_to_jsx.py
import os
import glob

# Directories to process
dirs = ['client/src', 'client/src/components', 'client/src/pages']

# Files to rename
files_to_rename = [
    'main.js',
    'App.js',
    'Home.js',
    'WalletImport.js',
    'WalletDashboard.js',
    'BalanceSection.js',
    'TokenList.js',
    'StakingAd.js',
    'ReferralSection.js'
]

# Rename files
for dir in dirs:
    for file in files_to_rename:
        old_path = os.path.join(dir, file)
        if os.path.exists(old_path):
            new_path = os.path.join(dir, file.replace('.js', '.jsx'))
            print(f'Renaming {old_path} to {new_path}')
            os.rename(old_path, new_path)

# Update imports in renamed files
for dir in dirs:
    for file in glob.glob(os.path.join(dir, '*.jsx')):
        with open(file, 'r', encoding='utf-8') as f:
            content = f.read()
        # Replace .js imports with .jsx
        updated_content = content
        for old_file in files_to_rename:
            old_import = old_file
            new_import = old_file.replace('.js', '.jsx')
            updated_content = updated_content.replace(old_import, new_import)
        if updated_content != content:
            print(f'Updating imports in {file}')
            with open(file, 'w', encoding='utf-8') as f:
                f.write(updated_content)

# Update vite.config.js
vite_config = 'client/vite.config.js'
with open(vite_config, 'r', encoding='utf-8') as f:
    content = f.read()
updated_content = content.replace("include: /\\.(js|jsx)$/", "include: /\\.jsx$/")
updated_content = updated_content.replace("loader: { '.js': 'jsx' }", "loader: { '.jsx': 'jsx' }")
updated_content = updated_content.replace("include: /\\.(js|jsx)$/", "include: /\\.jsx$/")
with open(vite_config, 'w', encoding='utf-8') as f:
    f.write(updated_content)
print(f'Updated {vite_config}')
print('Renaming complete.')