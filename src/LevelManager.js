import * as THREE from 'three';

export class LevelManager {
    constructor(scene) {
        this.scene = scene;
        this.rings = [];
        this.score = 0;
        
        this.initEnvironment();
        this.spawnLevel(1);
    }

    initEnvironment() {
        // Simple Building Outlines for a "Cyberpunk" feel
        const buildingGeo = new THREE.BoxGeometry(2, 10, 2);
        const buildingMat = new THREE.MeshPhongMaterial({ 
            color: 0x111111,
            emissive: 0x00f2ff,
            emissiveIntensity: 0.1
        });

        for (let i = 0; i < 20; i++) {
            const building = new THREE.Mesh(buildingGeo, buildingMat);
            building.position.set(
                (Math.random() - 0.5) * 100,
                5,
                (Math.random() - 0.5) * 100
            );
            // Don't spawn on the center
            if (building.position.length() > 10) {
                this.scene.add(building);
            }
        }
    }

    spawnLevel(levelNum) {
        // Clear old rings if any
        this.rings.forEach(r => this.scene.remove(r));
        this.rings = [];

        if (levelNum === 0) {
            console.log("Practice Mode: Level 0 Initialized");
            return; // No rings in practice mode
        }

        // Spawn 5 rings in a path
        const ringGeo = new THREE.TorusGeometry(1.5, 0.1, 16, 32);
        const ringMat = new THREE.MeshBasicMaterial({ color: 0x00f2ff, transparent: true, opacity: 0.8 });

        for (let i = 1; i <= 5; i++) {
            const ring = new THREE.Mesh(ringGeo, ringMat);
            ring.position.set(0, 5 + i * 2, -i * 15);
            ring.rotation.y = Math.PI / 2;
            this.scene.add(ring);
            this.rings.push(ring);
        }
    }

    checkCollisions(dronePosition) {
        // Check if drone passes through a ring
        for (let i = this.rings.length - 1; i >= 0; i--) {
            const ring = this.rings[i];
            const dist = dronePosition.distanceTo(ring.position);
            
            if (dist < 2.0) {
                // Collect!
                this.scene.remove(ring);
                this.rings.splice(i, 1);
                this.score += 100;
                this.updateScoreUI();
                
                // Play a visual effect (glow flash or something)
                this.flashRing(ring.position);
            }
        }
    }

    updateScoreUI() {
        const scoreEl = document.getElementById('current-score');
        if (scoreEl) scoreEl.textContent = this.score;
    }

    flashRing(pos) {
        // Placeholder for a particle or light effect
    }
}
