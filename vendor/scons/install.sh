#!/bin/bash
set -e

VER=2.0.1
wget http://prdownloads.sourceforge.net/scons/scons-${VER}.tar.gz
tar xf scons-${VER}.tar.gz
cd scons-${VER}
python setup.py install
