import * as THREE from 'three';
import * as CANNON from 'cannon-es';

export class Drone {
    constructor(scene, physicsWorld) {
        this.scene = scene;
        this.physicsWorld = physicsWorld;
        
        // Settings
        this.thrustForce = 15;
        this.rotationSpeed = 0.8;
        this.tiltForce = 4;
        
        this.initMesh();
        this.initPhysics();
    }

    initMesh() {
        this.group = new THREE.Group();
        
        // Central Body (Multi-material for top/bottom)
        const bodyGeo = new THREE.BoxGeometry(0.5, 0.1, 0.5);
        
        const sideMat = new THREE.MeshPhongMaterial({ color: 0x222222, emissive: 0x00f2ff, emissiveIntensity: 0.1 });
        const topMat = new THREE.MeshPhongMaterial({ color: 0x00ff00, emissive: 0x00ff00, emissiveIntensity: 0.2 }); // Green Top
        const botMat = new THREE.MeshPhongMaterial({ color: 0xff0000, emissive: 0xff0000, emissiveIntensity: 0.2 }); // Red Bottom
        
        // Face indices: 0: R, 1: L, 2: Top, 3: Bot, 4: Front, 5: Back
        const bodyMaterials = [sideMat, sideMat, topMat, botMat, sideMat, sideMat];
        const bodyMesh = new THREE.Mesh(bodyGeo, bodyMaterials);
        this.group.add(bodyMesh);

        // Front Marker (assuming -Z is forward for three.js and controls)
        const frontGeo = new THREE.BoxGeometry(0.2, 0.12, 0.1);
        const frontMat = new THREE.MeshBasicMaterial({ color: 0xffdd00 }); // Yellow/Orange marker
        const frontMesh = new THREE.Mesh(frontGeo, frontMat);
        frontMesh.position.set(0, 0, -0.26); // Stick out at the -Z front
        this.group.add(frontMesh);
        
        // Proportions/Arms
        const armGeo = new THREE.BoxGeometry(0.8, 0.05, 0.05);
        const armMat = new THREE.MeshPhongMaterial({ color: 0x333333 });
        
        const arm1 = new THREE.Mesh(armGeo, armMat);
        arm1.rotation.y = Math.PI / 4;
        this.group.add(arm1);
        
        const arm2 = new THREE.Mesh(armGeo, armMat);
        arm2.rotation.y = -Math.PI / 4;
        this.group.add(arm2);
        
        // Rotors (Neon Circles)
        const rotorGeo = new THREE.CylinderGeometry(0.15, 0.15, 0.02, 16);
        const rotorMat = new THREE.MeshBasicMaterial({ color: 0x00f2ff, transparent: true, opacity: 0.6 });
        
        this.rotors = [];
        const positions = [
            [0.3, 0.05, 0.3], [-0.3, 0.05, 0.3],
            [0.3, 0.05, -0.3], [-0.3, 0.05, -0.3]
        ];
        
        this.thrustTrails = [];

        positions.forEach(pos => {
            const rotor = new THREE.Mesh(rotorGeo, rotorMat);
            rotor.position.set(...pos);
            this.group.add(rotor);
            this.rotors.push(rotor);
            
            // Thrust trail for each rotor
            const trailGeo = new THREE.CylinderGeometry(0.12, 0.05, 1, 8);
            trailGeo.translate(0, -0.5, 0); // Origin at top so it scales downward
            const trailMat = new THREE.MeshBasicMaterial({ 
                color: 0x00f2ff, 
                transparent: true, 
                opacity: 0.0, 
                blending: THREE.AdditiveBlending 
            });
            const trail = new THREE.Mesh(trailGeo, trailMat);
            trail.position.set(...pos);
            this.group.add(trail);
            this.thrustTrails.push(trail);
        });

        this.scene.add(this.group);
    }

    initPhysics() {
        const shape = new CANNON.Box(new CANNON.Vec3(0.25, 0.05, 0.25));
        this.body = new CANNON.Body({
            mass: 1,
            linearDamping: 0.3, // Reduced from 0.8 to allow higher top speeds
            angularDamping: 0.8 // Kept high for flight stability
        });
        this.body.addShape(shape);
        this.body.position.set(0, 0.05, 0);
        this.physicsWorld.addBody(this.body);
    }

    update(state) {
        // Sync Mesh with Physics Body
        this.group.position.set(
            this.body.position.x,
            this.body.position.y,
            this.body.position.z
        );
        this.group.quaternion.set(
            this.body.quaternion.x,
            this.body.quaternion.y,
            this.body.quaternion.z,
            this.body.quaternion.w
        );
        
        // Engine Visual feedback
        let baseThrust = state ? Math.max(0.1, state.thrust) : 0.1;
        let pitchInput = state ? state.pitch : 0; 
        let rollInput = state ? state.roll : 0;   
        
        // Spin Rotors & modulate thrust trails
        // Rotor indices: 0: RearRight, 1: RearLeft, 2: FrontRight, 3: FrontLeft
        this.rotors.forEach((r, i) => {
            let engineLoad = baseThrust;
            
            // Front / Back pitch bias
            if (pitchInput > 0 && i < 2) engineLoad += pitchInput; // rear works harder to tilt forward
            if (pitchInput < 0 && i >= 2) engineLoad -= pitchInput; // front works harder to tilt back
            
            // Left / Right roll bias
            if (rollInput > 0 && i % 2 !== 0) engineLoad += rollInput; // left works harder to roll right
            if (rollInput < 0 && i % 2 === 0) engineLoad -= rollInput; // right works harder to roll left
            
            engineLoad = Math.max(0.1, engineLoad); // Minimum idle load
            
            // Spin velocity
            r.rotation.y += 0.3 * (1 + engineLoad);
            
            // Glow intensity
            r.material.opacity = 0.4 + (engineLoad * 0.2);
            
            // Trails
            const trail = this.thrustTrails[i];
            if (trail) {
                 const targetScale = Math.max(0.01, engineLoad * 1.5);
                 trail.scale.y = THREE.MathUtils.lerp(trail.scale.y, targetScale, 0.2);
                 trail.material.opacity = THREE.MathUtils.lerp(trail.material.opacity, engineLoad * 0.3, 0.2);
            }
        });
    }

    applyThrust(amount) {
        // Upward force in local coordinates
        const force = new CANNON.Vec3(0, amount * this.thrustForce, 0);
        const worldForce = this.body.quaternion.vmult(force);
        // CANNON's applyForce takes a force and a relativePoint (offset from center of mass)
        // Passing this.body.position would apply the force farther and farther away as the drone moved, causing huge torque and flipping!
        this.body.applyForce(worldForce, new CANNON.Vec3(0, 0, 0));
    }

    moveForward(amount) {
        // Tilt forward (-X torque for forward tilt)
        const localTorque = new CANNON.Vec3(-amount * this.tiltForce, 0, 0);
        const worldTorque = this.body.quaternion.vmult(localTorque);
        this.body.applyTorque(worldTorque);
    }

    moveSideways(amount) {
        // Tilt sideways
        const localTorque = new CANNON.Vec3(0, 0, -amount * this.tiltForce);
        const worldTorque = this.body.quaternion.vmult(localTorque);
        this.body.applyTorque(worldTorque);
    }

    rotate(amount) {
        // Yaw
        const localTorque = new CANNON.Vec3(0, amount * this.rotationSpeed, 0);
        const worldTorque = this.body.quaternion.vmult(localTorque);
        this.body.applyTorque(worldTorque);
    }

    autoLevel(pitchState, rollState) {
        // We removed the early return here!
        // Now auto-level runs continuously, fighting against W/A/S/D inputs.
        // This naturally limits the maximum tilt angle and creates an equilibrium, preventing flips!

        // The drone's local 'up' vector (Y-axis) in world coordinates
        const localUp = this.body.quaternion.vmult(new CANNON.Vec3(0, 1, 0));
        // The world's 'up' vector
        const worldUp = new CANNON.Vec3(0, 1, 0);

        // Cross product gives the axis and amount of rotation needed to align the two vectors
        const alignAxis = new CANNON.Vec3();
        localUp.cross(worldUp, alignAxis);

        // If completely upside down, the cross product is zero, so give it a nudge
        if (localUp.y < -0.9 && alignAxis.lengthSquared() < 0.01) {
            alignAxis.set(1, 0, 0);
        }

        // Apply corrective torque (multiplier acts like spring stiffness)
        const levelingStrength = 8;
        alignAxis.scale(levelingStrength, alignAxis);
        this.body.applyTorque(alignAxis);
    }
}
