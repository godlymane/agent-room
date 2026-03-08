#!/usr/bin/env python3

from setuptools import setup, find_packages

with open('README.md', 'r', encoding='utf-8') as f:
    long_description = f.read()

setup(
    name='duplicate-file-finder',
    version='1.0.0',
    description='Fast CLI tool to find and remove duplicate files using SHA256 hashing',
    long_description=long_description,
    long_description_content_type='text/markdown',
    author='DevData Reddy',
    author_email='dev@example.com',
    url='https://github.com/devdattareddy/duplicate-file-finder',
    license='MIT',
    py_modules=['duplicate_file_finder'],
    entry_points={
        'console_scripts': [
            'duplicate-file-finder=duplicate_file_finder:main',
        ],
    },
    python_requires='>=3.7',
    classifiers=[
        'Development Status :: 5 - Production/Stable',
        'Intended Audience :: Developers',
        'Intended Audience :: System Administrators',
        'License :: OSI Approved :: MIT License',
        'Operating System :: OS Independent',
        'Programming Language :: Python :: 3',
        'Programming Language :: Python :: 3.7',
        'Programming Language :: Python :: 3.8',
        'Programming Language :: Python :: 3.9',
        'Programming Language :: Python :: 3.10',
        'Programming Language :: Python :: 3.11',
        'Topic :: Utilities',
        'Topic :: System :: File Systems',
    ],
    keywords='duplicate files finder cleaner storage',
)
